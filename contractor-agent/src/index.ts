import { Sphere, createNodeProviders } from '@unicitylabs/sphere-sdk';

const MIN_PRICE = 3.0;
const SERVICE_TYPE = 'translation';

let sphere: Sphere | null = null;
const activeJobs: Map<string, { boss: string, offer: number, swapId?: string }> = new Map();

async function init() {
    console.log("Initializing Contractor Agent Sphere Wallet...");
    
    const providers = await createNodeProviders({ network: 'testnet2' });
    
    const initResult = await Sphere.init({
        ...providers,
        autoGenerate: true,
        network: 'testnet2',
        market: true,
    });
    
    sphere = initResult.sphere;
    
    if (initResult.created && initResult.generatedMnemonic) {
        console.log(`Contractor Agent created with new mnemonic: ${initResult.generatedMnemonic}`);
    }

    const identity = sphere.identity;
    console.log(`Contractor Agent Identity: ${identity?.directAddress}`);

    // Publish Intent
    console.log(`Publishing intent for service: ${SERVICE_TYPE} at min price ${MIN_PRICE}`);
    await sphere.market!.postIntent({
        type: SERVICE_TYPE,
        price: MIN_PRICE.toString(),
        description: `High-quality ${SERVICE_TYPE} bot`,
        turnaround: '60s'
    });

    // Listen for DMs
    sphere.communications.onMessage((msg: any) => {
        handleIncomingDM(msg);
    });

    console.log("Contractor Agent is ready and listening...");
}

async function handleIncomingDM(msg: any) {
    try {
        const payload = JSON.parse(msg.content);
        if (payload.type === 'OFFER') {
            const { jobId, offer } = payload;
            console.log(`Received OFFER for job ${jobId}: ${offer} UCT from ${msg.sender}`);
            
            if (offer >= MIN_PRICE) {
                activeJobs.set(msg.sender, { boss: msg.sender, offer });
                console.log(`Accepting offer. Countering with same offer to agree.`);
                await sphere!.communications.sendDM(msg.sender, JSON.stringify({
                    type: 'COUNTER_OFFER',
                    jobId,
                    offer: offer
                }));
            } else {
                console.log(`Offer below min price. Countering with ${MIN_PRICE}.`);
                activeJobs.set(msg.sender, { boss: msg.sender, offer: MIN_PRICE });
                await sphere!.communications.sendDM(msg.sender, JSON.stringify({
                    type: 'COUNTER_OFFER',
                    jobId,
                    offer: MIN_PRICE
                }));
            }
        } else if (payload.type === 'TASK_PAYLOAD') {
            const { jobId, task, swapId } = payload;
            console.log(`Received TASK_PAYLOAD for job ${jobId}. Task: ${task}, SwapId: ${swapId}`);
            
            const job = activeJobs.get(msg.sender);
            if (job) job.swapId = swapId;
            
            // Accept the swap deal (assuming Boss proposed it)
            if (swapId) {
                try {
                    await sphere!.swap!.acceptSwap(swapId);
                    console.log(`Accepted Swap ID: ${swapId}`);
                } catch(e) {
                    console.error("Error accepting swap:", e);
                }
            }

            // Perform work
            console.log(`Processing task...`);
            setTimeout(async () => {
                const result = `(Translated to French): Bonjour le monde. Original: ${task}`;
                console.log(`Delivering result for job ${jobId}`);
                await sphere!.communications.sendDM(msg.sender, JSON.stringify({
                    type: 'DELIVERY',
                    jobId,
                    result,
                    swapId
                }));
            }, 5000);
            
        } else if (payload.type === 'APPROVED') {
            const { swapId, jobId } = payload;
            console.log(`Job ${jobId} APPROVED. Completing Swap ${swapId}...`);
            // Complete our side of the swap by depositing (0 UCT)
            if (swapId) {
                try {
                    await sphere!.swap!.deposit(swapId);
                    console.log("Escrow claimed!");
                } catch (e) {
                    console.error("Error claiming escrow:", e);
                }
            }
        }
    } catch (e) {
        // Ignore
    }
}

init().catch(console.error);
