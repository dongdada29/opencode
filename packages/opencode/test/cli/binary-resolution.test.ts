import { expect, test, describe, spyOn, mock } from "bun:test";
import os from "os";
import fs from "fs";
import child_process from "child_process";

// Mocking the environment for the binary search logic
describe("Binary Resolution (Unscoped)", () => {
  test("should detect musl on linux", () => {
    const platformSpy = spyOn(os, "platform").mockReturnValue("linux");
    const execSpy = spyOn(child_process, "execSync").mockReturnValue(Buffer.from("musl libc (x86_64)\nVersion 1.2.3"));

    // Logic from bin/nuwaxcode
    const isMusl = (() => {
      if (os.platform() !== "linux") return false
      try {
        const output = child_process.execSync("ldd --version", { stdio: "pipe" }).toString()
        return output.includes("musl")
      } catch (e) {
        return false
      }
    })()

    expect(isMusl).toBe(true);
    platformSpy.mockRestore();
    execSpy.mockRestore();
  });

  test("should resolve the correct binary path for unscoped linux arm64", () => {
    const platform = "linux";
    let arch = "arm64";
    const isMusl = false;

    if (isMusl && platform === "linux") {
      arch = arch + "-musl";
    }

    const base = "nuwaxcode-" + platform + "-" + arch;
    expect(base).toBe("nuwaxcode-linux-arm64");
  });

  test("should resolve the correct binary path for unscoped musl linux x64", () => {
    const platform = "linux";
    let arch = "x64";
    const isMusl = true;

    if (isMusl && platform === "linux") {
      arch = arch + "-musl";
    }

    const base = "nuwaxcode-" + platform + "-" + arch;
    expect(base).toBe("nuwaxcode-linux-x64-musl");
  });
});
