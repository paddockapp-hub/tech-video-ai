// Headless browser verification: /auto 페이지에서 실제 3D WebM 영상이 생성되는지 검증
import puppeteer from "puppeteer";
import fs from "fs";

const OUT_VIDEO = "/workspace/verify_3d_output.webm";
const OUT_SHOT = "/workspace/verify_3d_page.png";

function log(...args) {
  console.log(new Date().toISOString().slice(11, 19), ...args);
}

const browser = await puppeteer.launch({
  headless: true,
  args: [
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--disable-dev-shm-usage",
    "--disable-gpu",
    "--use-gl=swiftshader",
    "--enable-unsafe-swiftshader",
    "--autoplay-policy=no-user-gesture-required",
    "--disable-web-security",
  ],
});

try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1366, height: 950 });
  page.on("pageerror", (e) => log("[pageerror]", e.message));
  page.on("console", (m) => {
    const t = m.text();
    if (t.includes("Error") || t.includes("Warning")) log("[console]", t.slice(0, 200));
  });

  const target = process.env.TARGET_URL || "http://localhost:3000";
  log("열기:", target + "/auto");
  await page.goto(target + "/auto", { waitUntil: "networkidle2", timeout: 90000 });
  await page.waitForSelector("button", { timeout: 30000 });

  // 대본을 짧게 줄여 렌더 시간을 최소화 (최소 12초)
  await page.evaluate(() => {
    const tas = [...document.querySelectorAll("textarea")];
    if (tas.length > 0) {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value").set;
      setter.call(tas[0], "3D 렌더 검증용 대본입니다. 입체 지오메트리가 회전합니다.");
      tas[0].dispatchEvent(new Event("input", { bubbles: true }));
    }
  });
  await new Promise((r) => setTimeout(r, 500));

  const btnText = await page.evaluate(() => {
    const btns = [...document.querySelectorAll("button")];
    const b = btns.find((x) => x.textContent.includes("무료 브라우저 영상 만들기"));
    if (b && !b.disabled) {
      b.click();
      return b.textContent.trim();
    }
    return null;
  });
  log("버튼 클릭:", btnText);
  if (!btnText) throw new Error("생성 버튼을 찾지 못했거나 비활성화 상태입니다.");

  // 렌더 진행 상태 확인용 주기 로그
  const statusPoll = setInterval(async () => {
    try {
      const s = await page.evaluate(() => document.body.innerText.match(/브라우저에서 영상 인코딩 중\.\.\. \d+%|영상 제작 진행 중\.\.\. \(\d+초\)/)?.[0] || "");
      if (s) log("진행:", s);
    } catch {}
  }, 5000);

  // 결과 비디오가 나올 때까지 대기 (최대 3분)
  log("렌더링 완료 대기 중...");
  await page.waitForSelector("video[src]", { timeout: 180000 });
  clearInterval(statusPoll);

  // 비디오 메타데이터 로드 대기
  await page.evaluate(() => {
    const v = document.querySelector("video");
    return new Promise((res) => {
      if (v.readyState >= 1) return res();
      v.addEventListener("loadedmetadata", res, { once: true });
      setTimeout(res, 5000);
    });
  });

  const info = await page.evaluate(async () => {
    const v = document.querySelector("video");
    const blob = await fetch(v.src).then((r) => r.blob());
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let binary = "";
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
    }
    return {
      b64: btoa(binary),
      size: blob.size,
      type: blob.type,
      duration: v.duration,
      w: v.videoWidth,
      h: v.videoHeight,
    };
  });

  fs.writeFileSync(OUT_VIDEO, Buffer.from(info.b64, "base64"));
  await page.screenshot({ path: OUT_SHOT });

  log("=== 결과 ===");
  log("포맷:", info.type);
  log("크기:", (info.size / 1024 / 1024).toFixed(2), "MB");
  log("해상도:", info.w + "x" + info.h);
  log("길이:", Number.isFinite(info.duration) ? info.duration.toFixed(1) + "초" : "메타데이터 없음(" + info.duration + ")");
  log("저장:", OUT_VIDEO, "/", OUT_SHOT);

  const ok = info.size > 100000 && info.w === 720 && info.h === 1280;
  log(ok ? "✅ 3D WebM 영상 생성 검증 통과" : "⚠️ 검증 조건 미충족");
  process.exitCode = ok ? 0 : 2;
} catch (e) {
  console.error("❌ 검증 실패:", e.message);
  try {
    await browser.newPage().then((p) => p.screenshot({ path: "/workspace/verify_3d_fail.png" }));
  } catch {}
  process.exitCode = 1;
} finally {
  await browser.close();
}
