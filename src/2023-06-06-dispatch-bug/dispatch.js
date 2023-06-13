// See gman's answer to "WebGPU compute shader gives unexpected result"
// https://stackoverflow.com/a/76437808/5850002

import {G, ADAPTER, GPU} from '../core/startup.js'

const F32_SIZE = new Float32Array(0).BYTES_PER_ELEMENT
const N = 1000
const BUFSIZE = F32_SIZE * N

/**
 * Buffer naming convention
 *
 * <X>:   A JavaScript array or WGSL array.
 * <X>_G: A R/W buffer corresponding to a shader array named <X>.
 * <X>_S: A RO staging buffer corresponding to a shader array named <X>.
 **/

const A_G = GPU.createBuffer({ size: BUFSIZE, usage: G.B.STORAGE  | G.B.COPY_DST | G.B.COPY_SRC })  // Compute buffer
const A_S = GPU.createBuffer({ size: BUFSIZE, usage: G.B.MAP_READ | G.B.COPY_DST })  // Staging buffer

import DISPATCH_CODE from './dispatch.wgsl';

function encode() {
  const pipeline = GPU.createComputePipeline({
    compute: { module: GPU.createShaderModule({ code: DISPATCH_CODE }), entryPoint: "test" },
    label: 'dispatch', layout: 'auto',
  })

  const bind_group = GPU.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),  // 'layout: auto' に作成された BindGroupLayout を取得
    entries: [{ binding: 0, resource: { buffer: A_G }}],
  })

  let encoder = GPU.createCommandEncoder()
  const pass = encoder.beginComputePass()
  pass.setPipeline(pipeline)
  pass.setBindGroup(0, bind_group)
  pass.dispatchWorkgroups(1)
  pass.end()
  encoder.copyBufferToBuffer(A_G, 0, A_S, 0, BUFSIZE)  // Staging A
  return encoder.finish()
}

export async function initialize(clickable, p) {
  clickable.addEventListener('click', () => on_click(p))

  // writeBuffer のテスト：偶奇性に応じて 0, 1 で埋めた配列を GPU に送る
  let _A = new Int32Array(N).map((_, i) => i % 2 == 0 ? 0 : 1)
  GPU.queue.writeBuffer(A_G, 0, _A)
}

export async function on_click(p) {
  GPU.queue.submit([encode()])  // 命令を発行

  // Staging buffer (A_S) への書き込みを待って、そのコピー (A) を取得
  await A_S.mapAsync(GPUMapMode.READ)
  const A = new Int32Array(A_S.getMappedRange()).slice()
  A_S.unmap()

  const freq = {}
  A.forEach((x, i) => { freq[x] = (x in freq ? freq[x] : 0) + 1 })
  p.innerHTML = JSON.stringify(freq)
}
