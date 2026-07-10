import { adapterContractTests } from "./adapter-contract";
import { createBetterSqliteAdapter } from "../drivers/better-sqlite3";

adapterContractTests("better-sqlite3", async () => createBetterSqliteAdapter());
