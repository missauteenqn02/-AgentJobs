# AgentJobs - Autonomous Agent Network

**This build is fully agentic — no human interaction occurs between task submission and final delivery.**

AgentJobs is a complete, working project built for the **Unicity Sphere Builder Program** (Track 1: "Autonomous agents"). It demonstrates an autonomous, closed-loop task economy where a "Boss Agent" delegates work to "Contractor Agents", negotiates prices, and finalizes settlements via atomic swaps on the Unicity network.

> Note: This build currently runs as standard Node.js background services and does NOT run on AstridOS.

## Architecture

```text
+-------------------+           +-------------------+
|                   |           |                   |
|   Frontend UI     | <---WS--- |    Boss Agent     |
| (Dashboard SPA)   |           |  (Node Service)   |
|                   |           |                   |
+--------+----------+           +--------+----------+
         |                               |
    (Submit Task)                        | (Sphere SDK Primitives)
         |                               v
         |                      1. Discover via MarketModule
         |                      2. DM via CommunicationsModule
         |                      3. Escrow via SwapModule
         v                               |
+-------------------+                    |
|                   |                    |
| Unicity Sphere    | <------------------+
|    Testnet v2     | <------------------+
|                   |                    |
+-------------------+                    |
         |                               |
         | (Market Intent, DMs, Swap)    |
         v                               v
+--------+----------+           +--------+----------+
|                   |           |                   |
| Contractor Agent 1|           | Contractor Agent 2|
|  (@translator)    |           |  (@summarizer)    |
|                   |           |                   |
+-------------------+           +-------------------+
```

### Deterministic vs. LLM Logic
This system is designed to provide guarantees on settlement and state transitions. **All negotiation, scoring, and state machine transitions are 100% deterministic rule-based logic**. There are no "LLMs pretending to negotiate." 
- **Negotiation logic**: Found in `boss-agent/src/negotiator.ts` and `contractor-agent/src/index.ts`.
- **State Machine**: Found in `boss-agent/src/state-machine.ts`.

## How to Run the Demo

### Prerequisites
- Node.js >= 22.0.0 (required by `@unicitylabs/sphere-sdk`)
- npm

### 1. Setup & Install
Clone the repository and install dependencies in all three workspaces:
```bash
cd dashboard && npm install
cd ../boss-agent && npm install
cd ../contractor-agent && npm install
```

### 2. Fund the Testnet Wallets
When you first start the agents, they will auto-generate new wallets on Testnet v2. 
You will see output similar to: `Boss Agent Identity: DIRECT://...`

1. Start the Boss Agent:
   ```bash
   cd boss-agent && npx ts-node src/index.ts
   ```
2. Start the Contractor Agent(s):
   ```bash
   cd contractor-agent && npx ts-node src/index.ts
   ```
3. Copy the `DIRECT://` addresses printed in their logs.
4. Go to the Unicity Sphere Faucet and request Testnet UCT for both addresses.

### 3. Run the Dashboard
In a new terminal window:
```bash
cd dashboard && npm run dev
```
Open the provided `localhost` URL in your browser.

### 4. Observe the Autonomous Flow
1. In the Dashboard, enter a task (e.g., "Translate this to French") and set a max budget.
2. Click **"Dispatch Boss Agent"**.
3. **Take your hands off the mouse and keyboard.**
4. Watch the Live Activity Feed stream the entire process:
   - The Boss queries the market for matching intents.
   - The Boss sends a DM offer.
   - The Contractor counters or accepts.
   - The Boss locks the escrow payment using the `SwapModule`.
   - The Contractor receives the task payload and begins work.
   - The Contractor delivers the result.
   - The Boss verifies the result and authorizes the escrow release.
5. The final translated text appears in the UI. Zero clicks were required after submission.
