export class SharedState {
    private static instance: SharedState | null = null;
    public lastFioRequestCheckTime: number = 0;
    public isProcessingGuesses: boolean = false;

    private constructor() {
        this.lastFioRequestCheckTime = 0;
        this.isProcessingGuesses = false;
    }

    public static getInstance(): SharedState {
        if (!SharedState.instance) {
            SharedState.instance = new SharedState();
        }
        return SharedState.instance;
    }

    public resetProcessingState(): void {
        this.isProcessingGuesses = false;
    }
}