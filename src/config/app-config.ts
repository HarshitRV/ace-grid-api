import { envSchema } from "@/schemas/common/env.js";

const env = envSchema.parse(process.env);
export const appConfig = {
    env
}
