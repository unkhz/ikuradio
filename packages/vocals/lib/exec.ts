import { spawn } from 'node:child_process'

/** Runs a program to its end. Resolves with what it said, rejects with what it complained. */
export function run(command: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args)
    let output = ''
    let complaint = ''
    child.stdout.on('data', (data) => (output += data))
    child.stderr.on('data', (data) => (complaint += data))
    child.on('error', reject)
    child.on('close', (code) => {
      if (code === 0) resolve(output)
      else
        reject(new Error(complaint.trim() || `${command} exited with ${code}`))
    })
  })
}
