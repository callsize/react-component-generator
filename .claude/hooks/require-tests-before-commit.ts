// PreToolUse 훅: git commit 직전에 전체 테스트를 실행하고, 실패하면 커밋을 차단한다.
// exit 2 = 도구 호출 차단 (stderr 내용이 Claude에게 전달된다).

const proc = Bun.spawnSync(["bun", "run", "test"], {
  stdout: "pipe",
  stderr: "pipe",
});

if (proc.exitCode === 0) process.exit(0);

const output = `${proc.stdout.toString()}\n${proc.stderr.toString()}`;
const tail = output.trim().split("\n").slice(-40).join("\n");

console.error(
  `테스트가 실패하여 커밋을 차단했습니다. 모든 테스트가 통과해야 커밋할 수 있습니다.\n\n${tail}`,
);
process.exit(2);
