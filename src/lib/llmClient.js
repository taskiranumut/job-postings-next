import OpenAI from 'openai';
import { JOB_EXTRACTION_SYSTEM_PROMPT } from './prompts';

/**
 * @typedef {Object} LLMInput
 * @property {string} platform_name
 * @property {string} url
 * @property {string} raw_text
 */

/**
 * @typedef {Object} JobPostingExtraction
 * @property {string} platform_name
 * @property {string|null} platform_job_id
 * @property {string} url
 * @property {string} [job_title]
 * @property {string} [company_name]
 * @property {string} [location_text]
 * @property {string} [work_mode]
 * @property {string} [employment_type]
 * @property {string} [seniority_level]
 * @property {string} [domain]
 * @property {string} [description_full]
 * @property {string} [responsibilities_text]
 * @property {string} [requirements_text]
 * @property {string} [nice_to_have_text]
 * @property {string} [benefits_text]
 * @property {number} [years_of_experience_min]
 * @property {number} [years_of_experience_max]
 * @property {string} [education_level]
 * @property {number} [salary_min]
 * @property {number} [salary_max]
 * @property {string} [salary_currency]
 * @property {string} [salary_period]
 * @property {string[]} [skills_required]
 * @property {string[]} [skills_nice_to_have]
 * @property {string[]} [tags]
 * @property {string|null} [posted_at]
 */

/**
 * Dummy LLM Client - LLM yapılandırılmadığında kullanılır
 */
class DummyLLMClient {
  constructor(modelName = 'gpt-dummy') {
    this.modelName = modelName;
  }

  /**
   * @param {LLMInput} input
   * @returns {Promise<JobPostingExtraction>}
   */
  async parseJobPosting(input) {
    console.error(
      `[DummyLLM] Error: LLM is not configured. Cannot process ${input.url}`
    );
    throw new Error(
      'LLM processing failed: LLM is not configured (DummyLLM active).'
    );
  }
}

/**
 * OpenAI LLM Client
 */
class OpenAILLMClient {
  /**
   * @param {string} apiKey
   * @param {string} modelName
   */
  constructor(apiKey, modelName = 'gpt-4o-mini') {
    this.apiKey = apiKey;
    this.modelName = modelName;
    this.client = new OpenAI({ apiKey: this.apiKey });
  }

  /**
   * @param {LLMInput} input
   * @returns {Promise<JobPostingExtraction>}
   */
  async parseJobPosting(input) {
    console.log(
      `[OpenAILLM] Processing ${input.url} with model ${this.modelName}`
    );

    const userMessage = JSON.stringify({
      platform_name: input.platform_name,
      url: input.url,
      raw_text: input.raw_text,
    });

    const completion = await this.client.chat.completions.create({
      model: this.modelName,
      messages: [
        { role: 'system', content: JOB_EXTRACTION_SYSTEM_PROMPT },
        { role: 'user', content: userMessage },
      ],
      response_format: { type: 'json_object' },
    });

    const content = completion.choices[0].message.content;
    if (!content) {
      throw new Error('OpenAI returned empty content');
    }

    try {
      const parsed = JSON.parse(content);
      return parsed;
    } catch (e) {
      console.error('Failed to parse OpenAI response as JSON:', content);
      throw new Error('Invalid JSON response from OpenAI');
    }
  }
}

/**
 * LLM Client Factory - Ortam değişkenlerine göre uygun client'ı seçer
 * @returns {DummyLLMClient | OpenAILLMClient}
 */
function createLLMClient() {
  const apiKey = process.env.LLM_API_KEY;
  const modelName = process.env.LLM_MODEL_NAME || 'gpt-4o-mini';

  if (apiKey) {
    console.log('Using OpenAI LLM Client');
    return new OpenAILLMClient(apiKey, modelName);
  } else {
    console.warn('LLM_API_KEY not found. Using Dummy LLM Client.');
    return new DummyLLMClient(modelName);
  }
}

export const llmClient = createLLMClient();
