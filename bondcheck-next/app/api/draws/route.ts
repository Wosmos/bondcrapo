import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { winners } from "@/lib/schema";
import { rateLimit } from "@/lib/rate-limit";
import {
  and,
  or,
  eq,
  gte,
  lte,
  like,
  inArray,
  asc,
  desc,
  sql,
  count,
  SQL,
} from "drizzle-orm";

export async function GET(request: NextRequest) {
  const rl = rateLimit(request, 5, 3, "draws");
  if (!rl.success) return rl.response!;
  const s = request.nextUrl.searchParams;

  const denomination = s.get("denomination")
    ? parseInt(s.get("denomination")!)
    : null;
  const limit = Math.min(
    Math.max(parseInt(s.get("limit") || "50"), 1),
    10000
  );
  const offset = Math.max(parseInt(s.get("offset") || "0"), 0);
  const position = s.get("position");
  const year = s.get("year");
  const startDate = s.get("start_date");
  const endDate = s.get("end_date");
  const minAmount = s.get("min_amount")
    ? parseInt(s.get("min_amount")!)
    : null;
  const maxAmount = s.get("max_amount")
    ? parseInt(s.get("max_amount")!)
    : null;
  const bondNumber = s.get("bond_number");
  const bondList = s.get("bond_list");
  const startBond = s.get("start_bond");
  const endBond = s.get("end_bond");
  const sortBy = s.get("sort_by") || "draw_date";
  const sortOrder = s.get("sort_order") || "DESC";

  try {
    const conditions: SQL[] = [];

    // Bond filters (OR group)
    const bondConditions: SQL[] = [];
    if (bondNumber) {
      bondConditions.push(like(winners.bondNumber, `${bondNumber}%`));
    }
    if (bondList) {
      const bonds = bondList
        .split(",")
        .map((b) => b.trim())
        .filter(Boolean);
      if (bonds.length) {
        bondConditions.push(inArray(winners.bondNumber, bonds));
      }
    }
    if (startBond && endBond) {
      bondConditions.push(
        sql`CAST(${winners.bondNumber} AS INTEGER) BETWEEN ${parseInt(startBond)} AND ${parseInt(endBond)}`
      );
    } else if (startBond) {
      bondConditions.push(
        sql`CAST(${winners.bondNumber} AS INTEGER) >= ${parseInt(startBond)}`
      );
    } else if (endBond) {
      bondConditions.push(
        sql`CAST(${winners.bondNumber} AS INTEGER) <= ${parseInt(endBond)}`
      );
    }
    if (bondConditions.length) {
      conditions.push(or(...bondConditions)!);
    }

    if (denomination) conditions.push(eq(winners.denomination, denomination));
    if (position) conditions.push(eq(winners.prizePosition, position));
    if (year) conditions.push(eq(winners.drawYear, year));
    if (minAmount) conditions.push(gte(winners.prizeAmount, minAmount));
    if (maxAmount) conditions.push(lte(winners.prizeAmount, maxAmount));

    // Date filtering — draw_date is stored as "DD-Mon-YYYY" text
    if (startDate) {
      conditions.push(
        sql`TO_DATE(${winners.drawDate}, 'DD-Mon-YYYY') >= ${startDate}::date`
      );
    }
    if (endDate) {
      conditions.push(
        sql`TO_DATE(${winners.drawDate}, 'DD-Mon-YYYY') <= ${endDate}::date`
      );
    }

    const whereClause = conditions.length ? and(...conditions) : undefined;

    // Sort
    const orderFn = sortOrder === "ASC" ? asc : desc;
    const sortColumn =
      sortBy === "bond_number"
        ? winners.bondNumber
        : sortBy === "prize_amount"
          ? winners.prizeAmount
          : sortBy === "denomination"
            ? winners.denomination
            : null; // draw_date handled separately below

    // For draw_date sort, use draw_year + id (safe, no TO_DATE parsing)
    const orderClauses = sortColumn !== null
      ? [orderFn(sortColumn)]
      : [orderFn(winners.drawYear), orderFn(winners.id)];

    const [draws, totalResult] = await Promise.all([
      db
        .select({
          id: winners.id,
          source: winners.source,
          denomination: winners.denomination,
          draw_date: winners.drawDate,
          draw_year: winners.drawYear,
          bond_number: winners.bondNumber,
          prize_position: winners.prizePosition,
          prize_amount: winners.prizeAmount,
        })
        .from(winners)
        .where(whereClause)
        .orderBy(...orderClauses)
        .limit(limit)
        .offset(offset),
      db
        .select({ total: count() })
        .from(winners)
        .where(whereClause),
    ]);

    return NextResponse.json({
      draws,
      total: totalResult[0].total,
      limit,
      offset,
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
