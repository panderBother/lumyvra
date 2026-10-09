import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { randomUUID } from "node:crypto";
import { runInNewContext } from "node:vm";
import ts from "typescript";

function moduleCode(path) {
  return ts.transpileModule(
    readFileSync(new URL(path, import.meta.url), "utf8"),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    },
  ).outputText;
}
const music = {};
runInNewContext(moduleCode("../src/lib/music.ts"), { exports: music });
const code = moduleCode("../src/lib/works.ts");
function setup(storage = new Map()) {
  let blocked = false,
    notifications = 0;
  const exports = {};
  runInNewContext(code, {
    exports,
    require: () => music,
    crypto: { randomUUID },
    Event,
    window: {
      localStorage: {
        getItem: (key) => storage.get(key) ?? null,
        setItem: (key, value) => {
          if (blocked) throw new Error("QuotaExceededError");
          storage.set(key, value);
        },
      },
      dispatchEvent: () => {
        notifications++;
      },
    },
  });
  return {
    api: exports,
    storage,
    block: () => {
      blocked = true;
    },
    notifications: () => notifications,
    read: () => exports.parseWorks(storage.get(exports.WORKS_KEY) ?? null),
  };
}
const input = {
  prompt: "海边的日落与晚风",
  mode: "text",
  genre: "民谣",
  mood: "治愈",
  seconds: 120,
  cover: "community_sunset",
  sourceId: "summer",
  sourceTitle: "夏日的风",
};

test("draft survives reload, is private, and cannot be published before generation completes", () => {
  const s = setup();
  const w = s.api.saveDraft(input);
  assert.equal(w.status, "draft");
  assert.equal(w.allowRemix, false);
  assert.equal(s.api.publishedWorks(s.read()).length, 0);
  assert.equal(s.api.remixableWorks(s.read()).length, 0);
  assert.throws(() => s.api.publishWork(w.id, "晚风", "", true), /先完成生成/);
  const reloaded = setup(s.storage);
  assert.equal(reloaded.read()[0].prompt, input.prompt);
  assert.equal(reloaded.read()[0].sourceTitle, "夏日的风");
  assert.equal(reloaded.read()[0].seconds, 120);
});
test("generation remains a draft; publishing is idempotent and opt-in controls inspiration visibility", () => {
  const s = setup();
  const a = s.api.saveDraft(input),
    b = s.api.saveDraft({ ...input, prompt: "另一首歌" });
  s.api.completeDraft(a.id);
  s.api.completeDraft(a.id);
  s.api.completeDraft(b.id);
  assert.equal(s.read().filter((w) => w.status === "draft").length, 2);
  s.api.publishWork(a.id, "晚风", "夏天的一段回忆", false);
  s.api.publishWork(b.id, "另一首歌", "可以做同款", true);
  s.api.publishWork(b.id, "不能重复改名", "", false);
  assert.equal(s.api.publishedWorks(s.read()).length, 2);
  const inspiration = s.api.remixableWorks(s.read());
  assert.equal(inspiration.length, 1);
  assert.equal(inspiration[0].id, b.id);
  assert.equal(inspiration[0].title, "另一首歌");
  assert.equal(s.read().filter((w) => w.status === "draft").length, 0);
  assert.throws(() => s.api.saveDraft(input, a.id), /已发布/);
});
test("continuing a draft updates it rather than duplicating; remix creates an independent draft", () => {
  const s = setup();
  const original = s.api.saveDraft(input);
  s.api.editWork(original.id, "手动命名", "我的介绍");
  const continued = s.api.saveDraft(
    { ...input, prompt: "改过的歌词", mode: "lyrics" },
    original.id,
  );
  assert.equal(s.read().length, 1);
  assert.equal(continued.title, "手动命名");
  assert.equal(continued.lyrics, "改过的歌词");
  s.api.completeDraft(original.id);
  const published = s.api.publishWork(
    original.id,
    "手动命名",
    "我的介绍",
    true,
  );
  const remixed = s.api.saveDraft({
    ...input,
    sourceId: published.id,
    sourceTitle: published.title,
  });
  assert.notEqual(remixed.id, published.id);
  assert.equal(remixed.status, "draft");
  assert.equal(s.api.remixableWorks(s.read()).length, 1);
});
test("storage failures leave the draft intact and never report a successful publication", () => {
  const s = setup();
  const w = s.api.saveDraft(input);
  s.api.completeDraft(w.id);
  const before = s.storage.get(s.api.WORKS_KEY),
    notifications = s.notifications();
  s.block();
  assert.throws(() => s.api.publishWork(w.id, "晚风", "", true), /保存失败/);
  assert.equal(s.storage.get(s.api.WORKS_KEY), before);
  assert.equal(s.notifications(), notifications);
  assert.equal(s.read()[0].status, "draft");
});
test("malformed storage is not overwritten; empty titles and missing records are rejected", () => {
  const s = setup();
  const w = s.api.saveDraft(input);
  s.api.completeDraft(w.id);
  assert.throws(() => s.api.publishWork(w.id, "  ", "", true), /作品名称/);
  assert.throws(() => s.api.completeDraft("missing"), /未找到/);
  s.storage.set(s.api.WORKS_KEY, '{"version":9,"works":[]}');
  assert.throws(() => s.api.saveDraft(input), /已保留/);
  assert.equal(s.storage.get(s.api.WORKS_KEY), '{"version":9,"works":[]}');
});

test("saving unchanged completed drafts preserves the result; changed settings or regeneration invalidate it", () => {
  const s = setup();
  const w = s.api.saveDraft(input);
  s.api.completeDraft(w.id);
  s.api.editWork(w.id, "晚风的新名字", "保留这段回忆");
  const saved = s.api.saveDraft(input, w.id);
  assert.equal(saved.ready, true);
  assert.equal(saved.title, "晚风的新名字");
  assert.equal(saved.description, "保留这段回忆");
  assert.equal(s.api.saveDraft(input, w.id, true).ready, false);
  s.api.completeDraft(w.id);
  assert.equal(s.api.saveDraft({ ...input, mood: "浪漫" }, w.id).ready, false);
  assert.equal(s.read().length, 1);
});

test("community search includes published works only and normalizes spaces and letter case", () => {
  const s = setup();
  const w = s.api.saveDraft(input);
  s.api.editWork(w.id, "Night Breeze", "");
  assert.equal(s.api.searchPublishedWorks(s.read(), "breeze").length, 0);
  s.api.completeDraft(w.id);
  s.api.publishWork(w.id, "Night Breeze", "", false);
  assert.equal(s.api.searchPublishedWorks(s.read(), "  NIGHT  ").length, 1);
  assert.equal(s.api.searchPublishedWorks(s.read(), "治愈").length, 1);
  assert.equal(s.api.searchPublishedWorks(s.read(), "不存在的作品").length, 0);
  assert.equal(s.api.remixableWorks(s.read()).length, 0);
});
