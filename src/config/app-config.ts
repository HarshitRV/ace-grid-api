import { envSchema } from "@/types/index.js";

const env = envSchema.parse(process.env);

export const appConfig = {
    env
}