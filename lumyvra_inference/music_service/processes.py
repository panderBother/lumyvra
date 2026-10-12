"""Release the complete owned process tree, including Windows venv launchers."""
import subprocess

import psutil


def terminate_owned_tree(process: subprocess.Popen):
    if process.poll() is not None:
        return
    try:
        root = psutil.Process(process.pid)
        owned = root.children(recursive=True)
        owned.reverse()
        owned.append(root)
        for child in owned:
            try:
                child.kill()
            except psutil.NoSuchProcess:
                pass
        _, alive = psutil.wait_procs(owned, timeout=15)
        if alive:
            raise RuntimeError("Owned inference processes did not exit")
    except psutil.NoSuchProcess:
        pass
    process.wait(timeout=15)
