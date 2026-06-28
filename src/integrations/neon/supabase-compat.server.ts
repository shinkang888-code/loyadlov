/**
 * Supabase PostgREST 호환 레이어 — 기존 supabase.from() 호출을 Neon SQL로 실행.
 * Server-only (.server.ts suffix via import path).
 */
import { getSql, type Sql } from "./db.server";

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type DbError = { message: string; code?: string };
export type DbResult<T> = { data: T; error: DbError | null };

type Filter =
  | { kind: "eq"; col: string; val: unknown }
  | { kind: "in"; col: string; vals: unknown[] }
  | { kind: "not_null"; col: string };

type OrderBy = { col: string; ascending: boolean };

function quoteIdent(name: string): string {
  if (!/^[a-z_][a-z0-9_]*$/i.test(name)) {
    throw new Error(`Invalid identifier: ${name}`);
  }
  return `"${name}"`;
}

function serializeForPg(val: unknown): unknown {
  if (val === undefined) return null;
  if (val === null) return null;
  if (typeof val === "object" && !Array.isArray(val) && !(val instanceof Date)) {
    return JSON.stringify(val);
  }
  if (Array.isArray(val) && val.length > 0 && typeof val[0] === "string") {
    return val;
  }
  return val;
}

function rowToSnake(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    out[k] = serializeForPg(v);
  }
  return out;
}

class NeonQueryBuilder<T = unknown> implements PromiseLike<DbResult<T>> {
  private mode: "select" | "insert" | "update" | "upsert" | "delete" = "select";
  private columns = "*";
  private filters: Filter[] = [];
  private orders: OrderBy[] = [];
  private limitVal?: number;
  private payload?: Record<string, unknown> | Record<string, unknown>[];
  private upsertConflict?: string;
  private returning = false;
  private singleMode: "none" | "single" | "maybe" = "none";

  constructor(
    private readonly sql: Sql,
    private readonly table: string,
  ) {}

  select(cols = "*"): this {
    if (this.mode === "select") {
      this.columns = cols;
    } else {
      this.returning = true;
      this.columns = cols;
    }
    return this;
  }

  insert(data: Record<string, unknown> | Record<string, unknown>[]): this {
    this.mode = "insert";
    this.payload = data;
    return this;
  }

  update(data: Record<string, unknown>): this {
    this.mode = "update";
    this.payload = data;
    return this;
  }

  upsert(data: Record<string, unknown>, opts?: { onConflict?: string }): this {
    this.mode = "upsert";
    this.payload = data;
    this.upsertConflict = opts?.onConflict;
    return this;
  }

  delete(): this {
    this.mode = "delete";
    return this;
  }

  eq(col: string, val: unknown): this {
    this.filters.push({ kind: "eq", col, val });
    return this;
  }

  in(col: string, vals: unknown[]): this {
    this.filters.push({ kind: "in", col, vals });
    return this;
  }

  not(col: string, op: string, val: unknown): this {
    if (op === "is" && val === null) {
      this.filters.push({ kind: "not_null", col });
    }
    return this;
  }

  order(col: string, opts?: { ascending?: boolean }): this {
    this.orders.push({ col, ascending: opts?.ascending ?? true });
    return this;
  }

  limit(n: number): this {
    this.limitVal = n;
    return this;
  }

  single(): this {
    this.singleMode = "single";
    return this;
  }

  maybeSingle(): this {
    this.singleMode = "maybe";
    return this;
  }

  then<TResult1 = DbResult<T>, TResult2 = never>(
    onfulfilled?: ((value: DbResult<T>) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }

  private buildWhere(startIdx: number): { clause: string; params: unknown[] } {
    const params: unknown[] = [];
    let idx = startIdx;
    const parts: string[] = [];

    for (const f of this.filters) {
      if (f.kind === "eq") {
        parts.push(`${quoteIdent(f.col)} = $${idx++}`);
        params.push(serializeForPg(f.val));
      } else if (f.kind === "in") {
        if (f.vals.length === 0) {
          parts.push("FALSE");
        } else {
          const placeholders = f.vals.map(() => `$${idx++}`).join(", ");
          parts.push(`${quoteIdent(f.col)} IN (${placeholders})`);
          params.push(...f.vals.map(serializeForPg));
        }
      } else if (f.kind === "not_null") {
        parts.push(`${quoteIdent(f.col)} IS NOT NULL`);
      }
    }

    return {
      clause: parts.length ? ` WHERE ${parts.join(" AND ")}` : "",
      params,
    };
  }

  private async execute(): Promise<DbResult<T>> {
    try {
      const table = quoteIdent(this.table);
      const rows = await this.runQuery(table);
      return this.formatResult(rows);
    } catch (e) {
      return {
        data: null as T,
        error: { message: e instanceof Error ? e.message : String(e) },
      };
    }
  }

  private async runQuery(table: string): Promise<Record<string, unknown>[]> {
    if (this.mode === "select") {
      const { clause, params } = this.buildWhere(1);
      let sql = `SELECT ${this.columns === "*" ? "*" : this.columns} FROM public.${table}${clause}`;
      if (this.orders.length) {
        sql += ` ORDER BY ${this.orders.map((o) => `${quoteIdent(o.col)} ${o.ascending ? "ASC" : "DESC"}`).join(", ")}`;
      }
      if (this.limitVal != null) sql += ` LIMIT ${this.limitVal}`;
      return (await this.sql.query(sql, params)) as Record<string, unknown>[];
    }

    if (this.mode === "insert") {
      const items = Array.isArray(this.payload) ? this.payload : [this.payload!];
      const results: Record<string, unknown>[] = [];
      for (const item of items) {
        const row = rowToSnake(item);
        const cols = Object.keys(row);
        const vals = Object.values(row);
        const placeholders = cols.map((_, i) => `$${i + 1}`).join(", ");
        let sql = `INSERT INTO public.${table} (${cols.map(quoteIdent).join(", ")}) VALUES (${placeholders})`;
        if (this.returning) sql += ` RETURNING ${this.columns === "*" ? "*" : this.columns}`;
        const inserted = (await this.sql.query(sql, vals)) as Record<string, unknown>[];
        results.push(...inserted);
      }
      return results;
    }

    if (this.mode === "update") {
      const row = rowToSnake(this.payload as Record<string, unknown>);
      const setCols = Object.keys(row);
      const setVals = Object.values(row);
      const setClause = setCols.map((c, i) => `${quoteIdent(c)} = $${i + 1}`).join(", ");
      const { clause, params: whereParams } = this.buildWhere(setCols.length + 1);
      let sql = `UPDATE public.${table} SET ${setClause}${clause}`;
      if (this.returning) sql += ` RETURNING ${this.columns === "*" ? "*" : this.columns}`;
      return (await this.sql.query(sql, [...setVals, ...whereParams])) as Record<string, unknown>[];
    }

    if (this.mode === "upsert") {
      const row = rowToSnake(this.payload as Record<string, unknown>);
      const cols = Object.keys(row);
      const vals = Object.values(row);
      const placeholders = cols.map((_, i) => `$${i + 1}`).join(", ");
      const conflict = (this.upsertConflict ?? cols[0])
        .split(",")
        .map((c) => quoteIdent(c.trim()))
        .join(", ");
      const updates = cols.map((c) => `${quoteIdent(c)} = EXCLUDED.${quoteIdent(c)}`).join(", ");
      let sql = `INSERT INTO public.${table} (${cols.map(quoteIdent).join(", ")}) VALUES (${placeholders}) ON CONFLICT (${conflict}) DO UPDATE SET ${updates}`;
      if (this.returning) sql += ` RETURNING ${this.columns === "*" ? "*" : this.columns}`;
      return (await this.sql.query(sql, vals)) as Record<string, unknown>[];
    }

    if (this.mode === "delete") {
      const { clause, params } = this.buildWhere(1);
      const sql = `DELETE FROM public.${table}${clause} RETURNING *`;
      return (await this.sql.query(sql, params)) as Record<string, unknown>[];
    }

    return [];
  }

  private formatResult(rows: Record<string, unknown>[]): DbResult<T> {
    if (this.singleMode === "single") {
      if (rows.length !== 1) {
        return { data: null as T, error: { message: "JSON object requested, multiple (or no) rows returned" } };
      }
      return { data: rows[0] as T, error: null };
    }
    if (this.singleMode === "maybe") {
      return { data: (rows[0] ?? null) as T, error: null };
    }
    if (this.mode !== "select" && this.returning && rows.length === 1) {
      return { data: rows[0] as T, error: null };
    }
    return { data: rows as T, error: null };
  }
}

export type NeonDbClient = {
  from: <T = unknown>(table: string) => NeonQueryBuilder<T>;
  rpc: <T = unknown>(fn: string, args?: Record<string, unknown>) => Promise<DbResult<T>>;
};

export function createNeonDb(): NeonDbClient {
  const sql = getSql();
  return {
    from<T>(table: string) {
      return new NeonQueryBuilder<T>(sql, table);
    },
    async rpc<T>(fn: string, args: Record<string, unknown> = {}): Promise<DbResult<T>> {
      try {
        if (fn === "claim_generation_jobs") {
          const limit = Number(args.p_limit ?? 3);
          const rows = await sql`SELECT * FROM public.claim_generation_jobs(${limit})`;
          return { data: rows as T, error: null };
        }
        return { data: null as T, error: { message: `Unknown RPC: ${fn}` } };
      } catch (e) {
        return {
          data: null as T,
          error: { message: e instanceof Error ? e.message : String(e) },
        };
      }
    },
  };
}

let _db: NeonDbClient | undefined;

export function getNeonDb(): NeonDbClient {
  if (!_db) _db = createNeonDb();
  return _db;
}

/** @deprecated Supabase 호환 alias — Neon Postgres */
export const supabaseAdmin = new Proxy({} as NeonDbClient, {
  get(_, prop, receiver) {
    return Reflect.get(getNeonDb(), prop, receiver);
  },
});

export type NeonDb = NeonDbClient;
