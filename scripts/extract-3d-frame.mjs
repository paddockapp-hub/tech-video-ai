// 생성된 WebM에서 실제 렌더 프레임을 추출해 3D 장면을 눈으로 확인
import puppeteer from "puppeteer";
import fs from "fs";

const browser = await puppeteer.launch({
  headless: true,
  args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--disable-gpu", "--use-gl=swiftshader", "--enable-unsafe-swiftshader"],
});
try {
  const page = await browser.newPage();
  const b64 = fs.readFileSync("/workspace/verify_3d_output.webm").toString("base64");
  const dataUrl = `data:video/webm;base64,${b64}`;
  const frame = await page.evaluate(async (src) => {
    const v = document.createElement("video");
    v.src = src;
    v.muted = true;
    document.body.appendChild(v);
    await new Promise((res) => {
      v.onloadedmetadata = res;
      setTimeout(res, 8000);
    });
    await new Promise((res) => {
      v.onseeked = res;
      v.currentTime = Math.min(6, (v.duration || 12) / 2);
      setTimeout(res, 8000);
    });
    const c = document.createElement("canvas");
    c.width = v.videoWidth || 720;
    c.height = v.videoHeight || 1280;
    c.getContext("2d").drawImage(v, 0, 0, c.width, c.height);
    return c.toDataURL("image/png");
  }, dataUrl);
  fs.writeFileSync("/workspace/verify_3d_frame.png", Buffer.from(frame.split(",")[1], "base64"));
  console.log("프레임 추출 완료: /workspace/verify_3d_frame.png");
} catch (e) {
  console.error("프레임 추출 실패:", e.message);
  process.exitCode = 1;
} finally {
  await browser.close();
}
