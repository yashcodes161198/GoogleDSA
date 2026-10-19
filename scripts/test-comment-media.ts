import assert from "node:assert/strict";
import sharp from "sharp";
import { validateMedia } from "../lib/leaderboard/validate-media";
import { MAX_MEDIA_BYTES } from "../lib/leaderboard/media-limits";
async function main() {
  const png=await sharp({create:{width:8,height:8,channels:4,background:"red"}}).png().toBuffer();
  const result=await validateMedia(png);
  assert.equal(result.extension,"png");
  assert.equal((await sharp(result.data).metadata()).width,8);
  for(const bytes of [Buffer.from("GIF89a invalid"),Buffer.from([137,80,78,71,13,10,26,10]),Buffer.alloc(MAX_MEDIA_BYTES+1)]) {
    await assert.rejects(validateMedia(bytes));
  }
  const big=await sharp({create:{width:2049,height:1,channels:4,background:"red"}}).png().toBuffer();
  await assert.rejects(validateMedia(big),/2048/);
  console.log("Media checks passed: decode/re-encode, unsupported/corrupt data, byte and pixel limits");
}
main().catch(error=>{ console.error(error);process.exitCode=1; });
