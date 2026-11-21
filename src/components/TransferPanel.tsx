"use client";
import { useState } from "react";

// 계좌 정보는 환경변수로: NEXT_PUBLIC_BANK_NAME / NEXT_PUBLIC_BANK_ACCOUNT / NEXT_PUBLIC_BANK_HOLDER
export default function TransferPanel() {
  const [plan, setPlan] = useState<"basic" | "pro">("basic");
  const [name, setName] = useState("");
  const [depositor, setDepositor] = useState("");
  const [result, setResult] = useState<string>("");
  const [loading, setLoading] = useState(false);

  async function submit() {
    setLoading(true); setResult("");
    try {
      const r = await fetch("/api/transfer-requests", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan, name, depositor }),
      });
      const j = await r.json();
      setResult(r.ok ? `신청 완료! ${j.amount.toLocaleString()}원을 입금해 주세요. 입금 확인 후 이용권이 열립니다.` : j.error || "실패");
    } catch { setResult("네트워크 오류"); }
    setLoading(false);
  }

  return (
    <div className="max-w-md space-y-3 rounded-xl border p-5">
      <h2 className="text-lg font-bold">계좌이체 결제</h2>
      <p className="text-sm">
        {process.env.NEXT_PUBLIC_BANK_NAME} {process.env.NEXT_PUBLIC_BANK_ACCOUNT} (예금주 {process.env.NEXT_PUBLIC_BANK_HOLDER})
      </p>
      <select className="w-full rounded border p-2" value={plan} onChange={(e) => setPlan(e.target.value as "basic" | "pro")}>
        <option value="basic">베이직 9,900원</option>
        <option value="pro">프로 29,900원</option>
      </select>
      <input className="w-full rounded border p-2" placeholder="이름" value={name} onChange={(e) => setName(e.target.value)} />
      <input className="w-full rounded border p-2" placeholder="입금자명" value={depositor} onChange={(e) => setDepositor(e.target.value)} />
      <button disabled={loading || !name || !depositor} onClick={submit}
        className="w-full rounded bg-black p-2 text-white disabled:opacity-40">
        {loading ? "처리 중…" : "입금 신청"}
      </button>
      {result && <p className="text-sm">{result}</p>}
    </div>
  );
}
