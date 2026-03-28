import { Plugin } from "../plugin"
import { Share } from "../share/share"
import { Format } from "../format"
import { LSP } from "../lsp"
import { FileWatcher } from "../file/watcher"
import { File } from "../file"
import { Project } from "./project"
import { Bus } from "../bus"
import { Command } from "../command"
import { Instance } from "./instance"
import { Vcs } from "./vcs"
import { Log } from "@/util/log"
import { ShareNext } from "@/share/share-next"
import { Snapshot } from "../snapshot"
import { Truncate } from "../tool/truncation"

export async function InstanceBootstrap() {
  Log.Default.info("bootstrapping", { directory: Instance.directory })
  await Plugin.init()

  // Run independent service inits in parallel
  await Promise.all([
    LSP.init().catch((err) => Log.Default.error("LSP.init failed", { error: err })),
    Promise.resolve().then(() => Share.init()),
    Promise.resolve().then(() => ShareNext.init()),
    Promise.resolve().then(() => Format.init()),
    Promise.resolve().then(() => FileWatcher.init()),
    Promise.resolve().then(() => File.init()),
    Promise.resolve().then(() => Vcs.init()),
    Promise.resolve().then(() => Snapshot.init()),
    Promise.resolve().then(() => Truncate.init()),
  ])

  Bus.subscribe(Command.Event.Executed, async (payload) => {
    if (payload.properties.name === Command.Default.INIT) {
      await Project.setInitialized(Instance.project.id)
    }
  })
}
