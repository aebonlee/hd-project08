/**
 * 서버 모드 통합 테스트 — 실행: scripts/sqltest/run-server-test.sh
 *
 * 이름에 **업무공유**가 들어간 도구다. 각자 브라우저에 담으면 공유가 되지 않는다.
 * 자료 한 뭉치(workspace)를 서버에 두고 팀원이 같은 것을 본다.
 *
 * 확인할 것 두 가지 —
 *   ① 한 사람이 저장한 것이 다른 사람에게 보이는가
 *   ② 두 사람이 동시에 고쳤을 때 **한쪽 작업이 조용히 사라지지 않는가**
 * ②가 이 방식의 유일한 위험이고, 버전 검사가 그것을 눈에 보이게 만든다.
 */
"use strict";
const assert = require("assert");
const path = require("path");
const vm = require("vm");
const fs = require("fs");
const { makeClient, query } = require("./fake-supabase.js");

const root = path.join(__dirname, "..");

function browser() {
  const box = { self: null, window: null, console,
    APP_CONFIG: { USE_SUPABASE: true, SUPABASE_URL: "http://local", SUPABASE_ANON_KEY: "local" },
    supabase: { createClient: makeClient },
    document: null, addEventListener() {}, alert() {},
    setTimeout, clearTimeout };
  box.self = box; box.window = box;
  vm.createContext(box);
  vm.runInContext(fs.readFileSync(path.join(root, "dashboard_marketing/js/hd-docsync.js"), "utf8"), box);
  return box;
}

const boot = (b, initial) => new Promise((res, rej) => {
  b.HDDoc.boot({ id: "marketing", initial: initial || {},
    onReady: (doc) => res(doc), onFallback: (e) => rej(e || new Error("데모로 내려갔다")) });
});
const one = (q) => (query(q).data || [])[0];

let passed = 0, failed = 0;
const tests = [];
const test = (n, f) => tests.push({ name: n, fn: f });

test("아무도 안 올렸으면 지금 브라우저의 자료를 씨앗으로 올린다", async () => {
  const A = browser();
  const doc = await boot(A, { tasks: [{ id: "t1", title: "런칭 기획", status: "진행" }] });
  assert.strictEqual(doc.tasks.length, 1);
  const r = one("select version, doc from public.workspace where id='marketing'");
  assert.strictEqual(Number(r.version), 1);
  assert.strictEqual(r.doc.tasks.length, 1, "씨앗이 안 올라갔다");
});

test("다른 팀원이 열면 같은 자료를 본다 (이게 이 도구의 목적이다)", async () => {
  const B = browser();
  const doc = await boot(B);
  assert.ok(doc.tasks && doc.tasks.length === 1, "팀원에게 안 보인다");
  assert.strictEqual(doc.tasks[0].title, "런칭 기획");
});

test("저장하면 서버 버전이 올라가고 팀원이 받는다", async () => {
  const A = browser();
  const doc = await boot(A);
  doc.tasks.push({ id: "t2", title: "카탈로그 검토", status: "대기" });
  A.HDDoc.save(doc);
  await A.HDDoc.flush();
  assert.strictEqual(Number(one("select version from public.workspace where id='marketing'").version), 2);

  const B = browser();
  const seen = await boot(B);
  assert.strictEqual(seen.tasks.length, 2, "팀원이 최신을 못 받았다");
});

test("동시에 고치면 나중 사람을 막고 알린다 (작업이 조용히 사라지지 않는다)", async () => {
  const A = browser(), B = browser();
  const dA = await boot(A), dB = await boot(B);
  let told = null;
  B.HDDoc.onNotify((m) => { told = m; });

  dA.meetings = [{ id: "m1", title: "A 가 먼저" }];
  A.HDDoc.save(dA); await A.HDDoc.flush();

  dB.meetings = [{ id: "m2", title: "B 가 나중" }];
  B.HDDoc.save(dB); await B.HDDoc.flush();

  assert.ok(told, "막혔는데 아무 말도 안 했다 — 사용자는 저장된 줄 안다");
  assert.ok(/먼저 저장/.test(told), "이유를 말하지 않는다: " + told);
  const r = one("select doc from public.workspace where id='marketing'");
  assert.strictEqual(r.doc.meetings.length, 1);
  assert.strictEqual(r.doc.meetings[0].title, "A 가 먼저", "덮어써서 A 의 작업이 사라졌다");
});

test("짧은 시간에 여러 번 고쳐도 저장은 한 번만 나간다", async () => {
  const A = browser();
  const doc = await boot(A);
  const before = Number(one("select version from public.workspace where id='marketing'").version);
  doc.actions = [{ id: "a1" }]; A.HDDoc.save(doc);
  doc.actions.push({ id: "a2" }); A.HDDoc.save(doc);
  doc.actions.push({ id: "a3" }); A.HDDoc.save(doc);
  await new Promise((r) => setTimeout(r, 900));
  const after = Number(one("select version from public.workspace where id='marketing'").version);
  assert.strictEqual(after, before + 1, "저장이 여러 번 나갔다 (" + before + "→" + after + ")");
  assert.strictEqual(one("select doc from public.workspace where id='marketing'").doc.actions.length, 3,
    "마지막 상태가 반영되지 않았다");
});

(async () => {
  for (const t of tests) {
    try { await t.fn(); passed++; console.log("  ✔ " + t.name); }
    catch (e) { failed++; console.error("  ✘ " + t.name); console.error("    " + (e && e.message)); }
  }
  console.log("\n결과: " + passed + " 통과, " + failed + " 실패");
  if (failed > 0) process.exit(1);
})();
