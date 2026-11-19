// Lazy-loaded on the assistant screen only (or to remove its cached weights).
import {CacheManager,ModelValidationStatus,Wllama} from '@wllama/wllama';
import wasm from '@wllama/wllama/esm/wasm/wllama.wasm?url';
import compatWasm from '@wllama/wllama-compat/wasm/wllama.wasm?url';
import compatWorker from '@wllama/wllama-compat/wasm/wllama.js?raw';
import type {ModelLoader} from './assistant';
import {modelURL,modelBytes} from './modelSpec';
const quiet = () => {};
export const loadLocalModel: ModelLoader = async (signal,progress) => {
  signal.throwIfAborted();
  if (!window.isSecureContext || !globalThis.WebAssembly || typeof Worker === 'undefined' || !navigator.storage?.getDirectory) {
    throw Error('unsupported');
  }
  // Check private/embedded storage *before* requesting a large download.
  await navigator.storage.getDirectory();
  const llm = new Wllama({default:wasm},{allowOffline:true, suppressNativeLog:true, logger:{debug:quiet,log:quiet,warn:quiet,error:quiet}});
  llm.setCompat({wasm:compatWasm,worker:{code:compatWorker}});
  const close = () => {void llm.exit().catch(quiet)};
  signal.addEventListener('abort',close,{once:true});
  try {
    signal.throwIfAborted();
    const cached = Math.max(0,await llm.cacheManager.getSize(await llm.cacheManager.getNameFromURL(modelURL)));
    const storage = await navigator.storage.estimate?.().catch(() => undefined);
    if (storage?.quota && storage.usage !== undefined && storage.quota-storage.usage < modelBytes-cached) throw Error('storage');
    signal.throwIfAborted();
    const file = await llm.modelManager.getModelOrDownload({url:modelURL},{signal,progressCallback:({loaded}) => {
      if (!signal.aborted) progress(Math.min(100,Math.floor(100*loaded/modelBytes)));
    }});
    signal.throwIfAborted();
    if (file.size !== modelBytes || file.validate() !== ModelValidationStatus.VALID) {await file.remove(); throw Error('incomplete')}
    progress(100);
    // CPU-only single-thread works on static Pages without WebGPU, COOP or COEP headers.
    await llm.loadModel(file,{n_threads:1,n_gpu_layers:0,n_parallel:1,n_ctx:2048,n_batch:128,warmup:false,reasoning:false});
    signal.throwIfAborted();
    return {close, async complete(messages,abortSignal,maxTokens=144,progress) {
      abortSignal.throwIfAborted();
      let text='',processed=0,truncated=false;
      await llm.createChatCompletion({messages,abortSignal,temperature:0.15,max_tokens:Math.min(144,maxTokens),chat_template_kwargs:{enable_thinking:false},
        stream:true,return_progress:true,onData:chunk=>{
          abortSignal.throwIfAborted();
          const n=chunk.prompt_progress?.processed ?? 0;
          if(n>processed){processed=n;progress?.('reading')}
          const choice=chunk.choices?.[0];
          // Report activity, not unverified tokens (which could reverse a tax rate).
          if(choice?.delta?.content){text+=choice.delta.content;progress?.('writing')}
          if(choice?.finish_reason==='length')truncated=true;
        }});
      abortSignal.throwIfAborted();
      return truncated?'':text;
    }};
  } catch (error) {close(); throw error} finally {signal.removeEventListener('abort',close)}
};

export async function removeCachedModel() {
  await new CacheManager().delete(modelURL);
}
