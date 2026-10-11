## Mode
find
## Symptom
Expected: WebLLM initializes and loads model record successfully from prebuiltAppConfig without throwing ModelNotFoundError.
Actual: WebLLM failed to load: ModelNotFoundError: Cannot find model record in appConfig for Qwen2.5-3B-Instruct-Q4_K_M. Please check if the model ID is correct and included in the model_list configuration.
## Red command
Command: node -e "const { prebuiltAppConfig } = require('@mlc-ai/web-llm'); const fs = require('fs'); const content = fs.readFileSync('src/services/webLLM.ts', 'utf8'); const match = content.match(/const MODEL_ID = '([^']+)'/); const modelId = match ? match[1] : ''; const found = prebuiltAppConfig.model_list.some(m => m.model_id === modelId); if (!found) { console.error('ModelNotFoundError: Cannot find model record in appConfig for ' + modelId); process.exit(1); }"
Output: ModelNotFoundError: Cannot find model record in appConfig for Qwen2.5-3B-Instruct-Q4_K_M (exit code 1)
## Working
`prebuiltAppConfig.model_list.find(m => m.model_id === 'Qwen2.5-3B-Instruct-q4f16_1-MLC')` returns valid MLC model record with HuggingFace weights and wasm URL. The one difference is the model identifier suffix (`-Q4_K_M` vs `-q4f16_1-MLC`).
## Cause
`src/services/webLLM.ts:13`: `const MODEL_ID = 'Qwen2.5-3B-Instruct-Q4_K_M';` uses GGUF/llama.cpp quantization naming convention instead of WebLLM MLC prebuilt model ID `Qwen2.5-3B-Instruct-q4f16_1-MLC`.
## Discarded
### Hypothesis 2: @mlc-ai/web-llm does not include Qwen2.5 models
Command: node -e "const { prebuiltAppConfig } = require('@mlc-ai/web-llm'); console.log('H2 Qwen2.5 count:', prebuiltAppConfig.model_list.filter(m => m.model_id.includes('Qwen2.5')).length);"
Output: H2 Qwen2.5 count: 22
Result: Discarded. The library includes 22 Qwen2.5 variants.

### Hypothesis 3: Custom appConfig is configured in project source
Command: git grep "appConfig" src/
Output: (empty)
Result: Discarded. Project relies on default prebuiltAppConfig from @mlc-ai/web-llm.
## Seam
`src/services/webLLM.test.ts` testing that `MODEL_ID` exported from `src/services/webLLM.ts` exists in `@mlc-ai/web-llm` `prebuiltAppConfig.model_list`.
## Next
repair started under --fix
