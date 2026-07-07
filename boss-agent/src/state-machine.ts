export type JobState = 
    | 'TASK_RECEIVED'
    | 'DISCOVERING_CONTRACTORS'
    | 'NEGOTIATING'
    | 'CONTRACTOR_SELECTED'
    | 'ESCROW_LOCKED'
    | 'WORK_IN_PROGRESS'
    | 'DELIVERED'
    | 'QUALITY_CHECKED'
    | 'COMPLETED'
    | 'DISPUTED'
    | 'REFUNDED'
    | 'RETRY_WITH_DIFFERENT_CONTRACTOR';

export interface JobEvent {
    state: JobState;
    timestamp: number;
    actor: string;
    details?: any;
}

export class JobTracker {
    public id: string;
    public currentState: JobState;
    public events: JobEvent[];

    constructor(id: string) {
        this.id = id;
        this.currentState = 'TASK_RECEIVED';
        this.events = [{
            state: 'TASK_RECEIVED',
            timestamp: Date.now(),
            actor: 'System'
        }];
    }

    public transition(newState: JobState, actor: string, details?: any) {
        // Log transition
        this.currentState = newState;
        this.events.push({
            state: newState,
            timestamp: Date.now(),
            actor,
            details
        });
        // Here we could trigger a callback to notify a dashboard
    }
}
