export interface Candidate {
    id: string;
    price: number; // lower is better
    turnaround: number; // lower is better
    pastJobs: number; // higher is better
}

export function scoreCandidate(c: Candidate): number {
    // Lower score is better
    const priceScore = c.price * 10;
    const turnaroundScore = c.turnaround * 0.1;
    const experienceBonus = c.pastJobs * 5;
    
    return priceScore + turnaroundScore - experienceBonus;
}

export function selectBestCandidate(candidates: Candidate[]): Candidate | null {
    if (candidates.length === 0) return null;
    return candidates.reduce((best, current) => {
        return scoreCandidate(current) < scoreCandidate(best) ? current : best;
    });
}

// Initial offer logic
export function calculateInitialOffer(listedPrice: number, maxBudget: number): number {
    const offer = listedPrice * 0.8;
    return Math.min(offer, maxBudget);
}
