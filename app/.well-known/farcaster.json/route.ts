import { NextResponse } from "next/server";

const farcasterAccountAssociation = {
  accountAssociation: {
    header:
      "eyJmaWQiOjM2ODU5MSwidHlwZSI6ImN1c3RvZHkiLCJrZXkiOiIweDVFNjA0MzlGYThFMjQ4OTEwQjk5RjYzMzI2NjY4RjhiNDJlRjg2NjQifQ",
    payload: "eyJkb21haW4iOiJiYXNlcXVlc3Qub25saW5lIn0",
    signature:
      "fBibcer5cNPi9Cw//bUKeep/D2LnwYVYDEyrgrSB8L9UpAEXiQJX5Q2D6UcxWfLW5iqmhs+F0wYU2tpXSrvCCRs=",
  },
} as const;

export function GET() {
  return NextResponse.json(farcasterAccountAssociation);
}
