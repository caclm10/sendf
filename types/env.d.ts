declare global {
    namespace NodeJS {
        interface ProcessEnv {
            APP_PORT: number;
            APP_URL: string;
        }
    }
}

export {}