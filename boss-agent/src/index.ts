import { Sphere, createNodeProviders } from '@unicitylabs/sphere-sdk';
import express from 'express';
import cors from 'cors';
import { WebSocketServer, WebSocket } from 'ws';
import { JobTracker, JobState } from './state-machine.js';
import { selectBestCandidate, calculateInitialOffer, Candidate } from './negotiator.js';

const app = express();
app.use(cors());
app.use(express.json());

const port = 3001;

let sphere: Sphere | null = null;
let wss: WebSocketServer | null = null;
const jobs: Map<string, JobTracker> = new Map();

function broadcast(msg: any) {
    if (!wss) return;
    const data = JSON.stringify(msg);
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(data);
        }
    });
}

function updateJobState(jobId: string, state: JobState, actor: string, details?: any) {
    let job = jobs.get(jobId);
    if (!job) {
        job = new JobTracker(jobId);
        jobs.set(jobId, job);
    }
    job.transition(state, actor, details);
    broadcast({ type: 'JOB_UPDATE', job });
}

async function init() {
    console.log("Initializing Boss Agent Sphere Wallet...");
    
    // Testnet config for node providers
    const providers = await createNodeProviders({ network: 'testnet2' });
    
    const initResult = await Sphere.init({
        ...providers,
        autoGenerate: true,
        network: 'testnet2',
        market: true,
    });
    
    sphere = initResult.sphere;
    
    if (initResult.created && initResult.generatedMnemonic) {
        console.log(`Boss Agent created with new mnemonic: ${initResult.generatedMnemonic}`);
    }

    const identity = sphere.identity;
    console.log(`Boss Agent Identity: ${identity?.directAddress}`);

    // Listen for DMs
    sphere.communications.onMessage((msg: any) => {
        handleIncomingDM(msg);
    });

    // Listen for swap proposals / etc if there's an event for it
    // Wait, the SDK has `swap` module but we don't have its type in memory here.
    // The Boss actually initiates the swap, so we only need to accept if Contractor initiates.
    
    startServer();
}

const pendingNegotiations: Map<string, { jobId: string, maxBudget: number }> = new Map();

async function handleIncomingDM(msg: any) {
    // DM handling logic (negotiation counters, delivery results)
    console.log(`Received DM from ${msg.sender}:`, msg.content);
    
    try {
        const payload = JSON.parse(msg.content);
        if (payload.type === 'COUNTER_OFFER') {
            const { jobId, offer } = payload;
            const neg = pendingNegotiations.get(msg.sender);
            if (neg && neg.jobId === jobId) {
                if (offer <= neg.maxBudget) {
                    // Accept and propose swap
                    updateJobState(jobId, 'CONTRACTOR_SELECTED', 'Boss', { contractor: msg.sender, price: offer });
                    
                    const swapDeal = {
                        partyA: sphere!.identity!.directAddress,
                        partyACurrency: 'UCT',
                        partyAAmount: Math.floor(offer * 1e8).toString(), // convert to smallest units
                        partyB: msg.sender,
                        partyBCurrency: 'UCT', // the contractor deposits 0 UCT
                        partyBAmount: '0',
                        timeout: 3600
                    };
                    
                    // propose swap
                    const proposal = await sphere!.swap!.proposeSwap(swapDeal);
                    updateJobState(jobId, 'ESCROW_LOCKED', 'Boss', { swapId: proposal.swapId });
                    
                    // Send task payload
                    const taskPayload = { type: 'TASK_PAYLOAD', jobId, task: 'Translate to French: Hello World', swapId: proposal.swapId };
                    await sphere!.communications.sendDM(msg.sender, JSON.stringify(taskPayload));
                    updateJobState(jobId, 'WORK_IN_PROGRESS', 'Boss');
                } else {
                    // Reject
                    await sphere!.communications.sendDM(msg.sender, JSON.stringify({ type: 'REJECT', jobId }));
                }
            }
        } else if (payload.type === 'DELIVERY') {
            const { jobId, result, swapId } = payload;
            updateJobState(jobId, 'DELIVERED', 'Contractor', { result });
            
            // Automated quality check
            if (result && result.length > 0) {
                updateJobState(jobId, 'QUALITY_CHECKED', 'Boss', { status: 'passed' });
                
                // Approve the escrow completion by sending an APPROVED signal so contractor can claim
                await sphere!.communications.sendDM(msg.sender, JSON.stringify({ type: 'APPROVED', swapId, jobId }));
                updateJobState(jobId, 'COMPLETED', 'System', { message: 'Escrow released to contractor' });
            } else {
                updateJobState(jobId, 'QUALITY_CHECKED', 'Boss', { status: 'failed' });
                await sphere!.swap!.cancelSwap(swapId);
                updateJobState(jobId, 'DISPUTED', 'Boss');
                updateJobState(jobId, 'REFUNDED', 'Boss');
            }
        }
    } catch (e) {
        // Not a JSON DM or unknown format, ignore
    }
}

app.post('/api/tasks', async (req, res) => {
    const { task, type, maxBudget } = req.body;
    const jobId = Math.random().toString(36).substring(7);
    
    updateJobState(jobId, 'TASK_RECEIVED', 'Human', { task, type, maxBudget });
    
    res.json({ jobId });
    
    // Background execution
    executeTask(jobId, task, type, maxBudget).catch(e => console.error("Task error:", e));
});

async function executeTask(jobId: string, task: string, type: string, maxBudget: number) {
    updateJobState(jobId, 'DISCOVERING_CONTRACTORS', 'Boss', { type });
    
    // Wait a sec for visual effect in dashboard
    await new Promise(r => setTimeout(r, 2000));
    
    // Search Market
    const searchRes = await sphere!.market!.search(type);
    const intents = searchRes.results || [];
    
    if (intents.length === 0) {
        updateJobState(jobId, 'DISPUTED', 'System', { error: 'No contractors found' });
        return;
    }
    
    const candidates: Candidate[] = intents.map((i: any) => ({
        id: i.maker,
        price: parseFloat(i.price || '0'),
        turnaround: 60,
        pastJobs: 5
    }));
    
    const best = selectBestCandidate(candidates);
    if (!best) return;
    
    updateJobState(jobId, 'NEGOTIATING', 'Boss', { bestCandidate: best.id });
    
    // Send DM
    pendingNegotiations.set(best.id, { jobId, maxBudget });
    
    const initialOffer = calculateInitialOffer(best.price, maxBudget);
    await sphere!.communications.sendDM(best.id, JSON.stringify({
        type: 'OFFER',
        jobId,
        service: type,
        offer: initialOffer
    }));
}

function startServer() {
    const server = app.listen(port, () => {
        console.log(`Boss Agent Dashboard API running on http://localhost:${port}`);
    });
    
    wss = new WebSocketServer({ server });
    wss.on('connection', (ws) => {
        console.log("Dashboard connected");
        // Send initial state
        jobs.forEach(job => {
            ws.send(JSON.stringify({ type: 'JOB_UPDATE', job }));
        });
    });
}

init().catch(console.error);
