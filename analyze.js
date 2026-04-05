require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { getNextJobToAnalyze, markJobAnalyzed, getJobById } = require('./database.js');

// Suporta múltiplas chaves de API separadas por vírgula para fallback
const OPENROUTER_API_KEYS = (process.env.OPENROUTER_API_KEYS || process.env.OPENROUTER_API_KEY || '').split(',').map(k => k.trim()).filter(k => k);
// Modelos também podem ser múltiplos (separados por vírgula) para fallback
const OPENROUTER_MODELS = (process.env.OPENROUTER_MODEL || 'openai/gpt-4o').split(',').map(m => m.trim()).filter(m => m);

const CV_PATH = path.join(__dirname, 'public', 'cv.md');
const ANALISES_DIR = path.join(__dirname, 'analises');

async function callOpenRouterWithFallback(prompt, apiKeys, models, maxRetries = 3) {
  if (apiKeys.length === 0) {
    throw new Error('Nenhuma OPENROUTER_API_KEY configurada no .env');
  }

  let lastError = null;
  let triedFirstModelTwice = false;

  // Loop principal de modelos
  for (let modelIndex = 0; modelIndex < models.length; modelIndex++) {
    const currentModel = models[modelIndex];
    console.log(`🤖 Tentando com modelo ${modelIndex + 1}/${models.length}: ${currentModel}`);
    
    // Loop de chaves de API
    for (let keyIndex = 0; keyIndex < apiKeys.length; keyIndex++) {
      const apiKey = apiKeys[keyIndex];
      console.log(`🔑 Tentando com API Key ${keyIndex + 1}/${apiKeys.length}...`);
      
      // Retry loop
      for (let retry = 0; retry < maxRetries; retry++) {
        try {
          const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${apiKey}`,
              'HTTP-Referer': 'https://linkedin-jobs-scraping.local',
              'X-Title': 'LinkedIn Job Analyzer'
            },
            body: JSON.stringify({
              model: currentModel,
              messages: [
                {
                  role: 'system',
                  content: `Você é um assistente de análise de carreiras especializado em comparar vagas de emprego com currículos de desenvolvedores. Sua tarefa é analisar cada vaga e fornecer feedback estruturado sobre a compatibilidade do candidato. Responda SEMPRE em português do Brasil. Use formato Markdown bem estruturado.`
                },
                {
                  role: 'user',
                  content: prompt
                }
              ]
            })
          });

          if (response.status === 429) {
            // Rate limit - decide next step based on model index
            if (modelIndex === 0 && !triedFirstModelTwice) {
              // Primeiro modelo com rate limit → retry uma vez antes de mudar
              console.log(`⚠️ Rate limited no primeiro modelo, tentando novamente...`);
              triedFirstModelTwice = true;
              break; // Sai do loop de chaves para retry com mesmo modelo
            } else {
              console.log(`⚠️ Rate limited, tentando próximo modelo...`);
              break; // Próximo modelo
            }
          }

          if (!response.ok) {
            const error = await response.text();
            throw new Error(`OpenRouter API error: ${response.status} - ${error}`);
          }

          const data = await response.json();
          return data.choices[0].message.content;

        } catch (err) {
          lastError = err;
          if (err.message.includes('429') || err.message.includes('rate-limited')) {
            console.log(`⚠️ Rate limit detectado, tentando novamente em ${(retry + 1) * 2}s...`);
            await new Promise(resolve => setTimeout(resolve, 2000 * (retry + 1)));
            continue;
          }
          // Erro não-retryable com esta chave
          console.log(`⚠️ Erro com API Key ${keyIndex + 1}: ${err.message}`);
          break;
        }
      }
    }
  }

  throw lastError || new Error('Todas as combinações de API keys e modelos falharam');
}

function buildPrompt(job, cvContent) {
  return `
# Análise de Vaga vs Currículo

## DADOS DA VAGA

**Título:** ${job.title || 'N/A'}
**Empresa:** ${job.company || 'N/A'}
**Localização:** ${job.location || 'N/A'}
**Match de Keywords:** ${job.match || 0}%
**Palavras que deu Match:** ${job.match_words || 'Nenhuma'}
**Link:** ${job.link || 'N/A'}

### Descrição da Vaga:
${job.description || 'Não disponível'}

---

## CURRÍCULO DO CANDIDATO

${cvContent}

---

## SUA TAREFA:

Analise a vaga acima e compare com o currículo fornecido. Forneça uma análise detalhada em português do Brasil com o seguinte estrutura:

## 🎯 Veredicto
**Pontuação:** X% (baseado em suas habilidades vs requisitos)

## ✅ Pontos Fortes
- Liste as habilidades/conhecimentos do currículo que se alinham com a vaga
- Seafoe em skills técnicas específicas mencionadas

## ❌ Gaps / Pontos Fracos
- Liste habilidades/requisitos da vaga que NÃO constam no currículo
- Seja honesto sobre o que falta

## 📚 Sugestões de Estudo
- O que estudar/focar para essa vaga?
- Tecnologias ou conceitos específicos

## 💡 Observações Adicionais
- Qual a sua visão geral sobre essa vaga?
- Há algo que chama atenção?

Retorne APENAS o conteúdo da análise em formato Markdown, sem código ou explicações adicionais.
`;
}

async function analyzeJob(job, cvContent) {
  const prompt = buildPrompt(job, cvContent);
   
  console.log(`🤖 Enviando para análise...`);
  
  const analysis = await callOpenRouterWithFallback(prompt, OPENROUTER_API_KEYS, OPENROUTER_MODELS);
  
  return analysis;
}

async function saveAnalysis(job, analysis) {
  if (!fs.existsSync(ANALISES_DIR)) {
    fs.mkdirSync(ANALISES_DIR, { recursive: true });
  }

  // Gerar título com 3 primeiras palavras
  const titleWords = (job.title || 'vaga').split(' ').slice(0, 3).join(' ');
  const match = job.match || 0;
  const jobId = job.job_id || job.rowid;
  
  // Limpar caracteres inválidos do nome do arquivo
  const cleanTitle = titleWords.replace(/[^a-zA-Z0-9-_]/g, '');
  
  const filename = `${match}% - ${cleanTitle}_${jobId}.md`;
  const filepath = path.join(ANALISES_DIR, filename);

  const content = `# Análise: ${job.title || 'Vaga'}
**Job ID:** ${job.job_id || 'N/A'}
**Match Original:** ${job.match || 0}%
**Data da Análise:** ${new Date().toISOString().split('T')[0]}
**Empresa:** ${job.company || 'N/A'}
**Localização:** ${job.location || 'N/A'}
**Link:** ${job.link || 'N/A'}

---

${analysis}
`;

  fs.writeFileSync(filepath, content);
  console.log(`✅ Análise salva em: analises/${filename}`);
}

async function runAnalyze(count = 1) {
  console.log('🚀 Iniciando analisador de vagas...\n');

  // Verificar CV
  if (!fs.existsSync(CV_PATH)) {
    console.error('❌ Currículo não encontrado em:', CV_PATH);
    console.log('   Crie o arquivo public/cv.md primeiro');
    process.exit(1);
  }

  const cvContent = fs.readFileSync(CV_PATH, 'utf8');
  console.log('✅ Currículo carregado\n');

  // Verificar API keys
  if (OPENROUTER_API_KEYS.length === 0) {
    console.error('❌ OPENROUTER_API_KEYS não configurada no .env');
    console.log('   Formato: OPENROUTER_API_KEYS=key1,key2,key3');
    process.exit(1);
  }

  console.log(`✅ ${OPENROUTER_API_KEYS.length} API key(s) configurada(s)`);
  console.log(`✅ ${OPENROUTER_MODELS.length} modelo(s) configurado(s): ${OPENROUTER_MODELS.join(', ')}\n`);

  let analyzed = 0;
  let errors = 0;

  for (let i = 0; i < count; i++) {
    console.log(`\n--- Vaga ${i + 1} de ${count} ---\n`);

    try {
      const job = await getNextJobToAnalyze();
      
      if (!job) {
        console.log('📭 Nenhuma vaga pendente para análise!');
        console.log('   Execute "npm run score" para calcular matches primeiro');
        break;
      }

      console.log(`📋 Job: ${job.title || 'Sem título'}`);
      console.log(`   Empresa: ${job.company || 'N/A'}`);
      console.log(`   Match: ${job.match || 0}%`);

      const analysis = await analyzeJob(job, cvContent);
      await saveAnalysis(job, analysis);
      await markJobAnalyzed(job.rowid);

      analyzed++;
      console.log(`\n✅ Vaga ${job.rowid} analisada com sucesso!`);

    } catch (err) {
      console.error('❌ Erro ao analisar vaga:', err.message);
      errors++;
    }
  }

  console.log('\n========================================');
  console.log(`✅ Análise concluída!`);
  console.log(`   Vagas analisadas: ${analyzed}`);
  console.log(`   Erros: ${errors}`);
  console.log('========================================\n');
}

// Parse arguments
const args = process.argv.slice(2);
let count = 1;

if (args[0] === 'all' || args[0] === '--all') {
  // Analyze all non-analyzed jobs
  count = 999999;
} else if (args[0] && !args[0].startsWith('-')) {
  count = parseInt(args[0]) || 1;
}

runAnalyze(count).catch(console.error);
