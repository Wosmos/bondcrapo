import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import {
  calculatePrizeBondTax,
  calculateSavingsTax,
  calculateMaturityValue,
  calculateExpectedValue,
  compareAllDenominations,
  type FilerStatus,
} from "@/lib/tax";

export async function GET(request: NextRequest) {
  const rl = rateLimit(request, 15, 10, "tax");
  if (!rl.success) return rl.response!;

  const { searchParams } = request.nextUrl;
  const mode = searchParams.get("mode") ?? "prize";
  const filerStatus = (searchParams.get("filer_status") ?? "filer") as FilerStatus;

  try {
    switch (mode) {
      case "prize": {
        const amount = Number(searchParams.get("amount"));
        if (!amount || amount <= 0) {
          return NextResponse.json(
            { error: "Valid amount parameter required" },
            { status: 400 }
          );
        }
        return NextResponse.json(calculatePrizeBondTax(amount, filerStatus));
      }

      case "savings": {
        const profit = Number(searchParams.get("profit"));
        if (!profit || profit <= 0) {
          return NextResponse.json(
            { error: "Valid profit parameter required" },
            { status: 400 }
          );
        }
        return NextResponse.json(calculateSavingsTax(profit, filerStatus));
      }

      case "maturity": {
        const principal = Number(searchParams.get("principal"));
        const rate = Number(searchParams.get("rate"));
        const years = Number(searchParams.get("years"));
        const compounding = Number(searchParams.get("compounding")) || 1;

        if (!principal || !rate || !years) {
          return NextResponse.json(
            { error: "principal, rate, and years parameters required" },
            { status: 400 }
          );
        }
        return NextResponse.json(
          calculateMaturityValue(principal, rate, years, compounding, filerStatus)
        );
      }

      case "expected_value": {
        const denomination = Number(searchParams.get("denomination"));
        if (!denomination) {
          return NextResponse.json(
            { error: "Valid denomination parameter required" },
            { status: 400 }
          );
        }
        const result = calculateExpectedValue(denomination, filerStatus);
        if (!result) {
          return NextResponse.json(
            { error: `Unknown denomination: ${denomination}` },
            { status: 400 }
          );
        }
        return NextResponse.json(result);
      }

      case "compare": {
        return NextResponse.json({
          denominations: compareAllDenominations(filerStatus),
        });
      }

      default:
        return NextResponse.json(
          { error: `Unknown mode: ${mode}. Use prize, savings, maturity, expected_value, or compare.` },
          { status: 400 }
        );
    }
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
