// ============================================================
// JPM Chrome Extension - Background Service Worker
// ============================================================

// Configuration - UPDATE THESE VALUES BEFORE INSTALLING
const CONFIG = {
  // Backend API endpoint
  // For local development: 'http://localhost:3000/api/job-postings/from-extension'
  // For production: Your Vercel/deployed URL
  API_URL: 'http://localhost:3000/api/job-postings/from-extension',

  // Shared secret for authentication - MUST match EXTENSION_SHARED_SECRET in your .env file
  // Generate a secure random string and paste it here and in your .env file
  SHARED_SECRET: 'change-me-to-your-secure-secret',
};

// ============================================================
// LinkedIn Page Detection
// ============================================================

/**
 * Check if a URL is a LinkedIn job posting page
 * @param {string} url - The URL to check
 * @returns {boolean}
 */
function isLinkedInJobPage(url) {
  if (!url) return false;
  try {
    const urlObj = new URL(url);
    return (
      urlObj.hostname === 'www.linkedin.com' &&
      (urlObj.pathname.includes('/jobs/view/') ||
        urlObj.pathname.includes('/jobs/collections/'))
    );
  } catch {
    return false;
  }
}

// ============================================================
// Visual Feedback Helpers
// ============================================================

/**
 * Set badge on the extension icon
 * @param {string} text - Badge text (empty to clear)
 * @param {string} color - Badge background color
 */
async function setBadge(text, color = '#4CAF50') {
  await chrome.action.setBadgeText({ text });
  await chrome.action.setBadgeBackgroundColor({ color });
}

/**
 * Show temporary badge that auto-clears
 * @param {string} text - Badge text
 * @param {string} color - Badge color
 * @param {number} duration - Duration in ms before clearing
 */
async function showTemporaryBadge(text, color, duration = 3000) {
  await setBadge(text, color);
  setTimeout(() => setBadge(''), duration);
}

/**
 * Show a Chrome notification (backup notification method)
 * @param {string} title - Notification title
 * @param {string} message - Notification message
 * @param {boolean} isError - Whether this is an error notification
 */
function showChromeNotification(title, message, isError = false) {
  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'icons/icon-128.png',
    title: title,
    message: message,
    priority: isError ? 2 : 1,
  });
}

/**
 * Inject a toast notification into the page
 * This function runs in the page context
 * @param {string} message - Message to display
 * @param {boolean} isError - Whether this is an error
 */
function injectToast(message, isError = false) {
  // Remove existing toast if any
  const existingToast = document.getElementById('jpm-toast');
  if (existingToast) {
    existingToast.remove();
  }

  // Create toast container
  const toast = document.createElement('div');
  toast.id = 'jpm-toast';
  toast.innerHTML = `
    <div style="
      position: fixed;
      bottom: 24px;
      right: 24px;
      z-index: 999999;
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 16px 20px;
      background: ${isError ? '#1a1a1a' : '#1a1a1a'};
      border: 1px solid ${isError ? '#ef4444' : '#22c55e'};
      border-radius: 12px;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.05);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      color: #fff;
      animation: jpm-slide-in 0.3s cubic-bezier(0.16, 1, 0.3, 1);
      backdrop-filter: blur(10px);
    ">
      <div style="
        width: 32px;
        height: 32px;
        border-radius: 50%;
        background: ${
          isError ? 'rgba(239, 68, 68, 0.15)' : 'rgba(34, 197, 94, 0.15)'
        };
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      ">
        ${
          isError
            ? '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>'
            : '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>'
        }
      </div>
      <div style="display: flex; flex-direction: column; gap: 2px;">
        <span style="font-weight: 600; color: ${
          isError ? '#ef4444' : '#22c55e'
        };">
          JPM ${isError ? '✗' : '✓'}
        </span>
        <span style="color: rgba(255, 255, 255, 0.8); font-size: 13px;">
          ${message}
        </span>
      </div>
    </div>
    <style>
      @keyframes jpm-slide-in {
        from {
          opacity: 0;
          transform: translateX(100px);
        }
        to {
          opacity: 1;
          transform: translateX(0);
        }
      }
      @keyframes jpm-slide-out {
        from {
          opacity: 1;
          transform: translateX(0);
        }
        to {
          opacity: 0;
          transform: translateX(100px);
        }
      }
    </style>
  `;

  document.body.appendChild(toast);

  // Auto-remove after 4 seconds with animation
  setTimeout(() => {
    const toastEl = document.getElementById('jpm-toast');
    if (toastEl) {
      toastEl.firstElementChild.style.animation =
        'jpm-slide-out 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards';
      setTimeout(() => toastEl.remove(), 300);
    }
  }, 4000);
}

/**
 * Show loading toast in the page
 */
function injectLoadingToast() {
  // Remove existing toast if any
  const existingToast = document.getElementById('jpm-toast');
  if (existingToast) {
    existingToast.remove();
  }

  const toast = document.createElement('div');
  toast.id = 'jpm-toast';
  toast.innerHTML = `
    <div style="
      position: fixed;
      bottom: 24px;
      right: 24px;
      z-index: 999999;
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 16px 20px;
      background: #1a1a1a;
      border: 1px solid #3b82f6;
      border-radius: 12px;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.05);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      color: #fff;
      animation: jpm-slide-in 0.3s cubic-bezier(0.16, 1, 0.3, 1);
      backdrop-filter: blur(10px);
    ">
      <div style="
        width: 32px;
        height: 32px;
        border-radius: 50%;
        background: rgba(59, 130, 246, 0.15);
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      ">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="animation: jpm-spin 1s linear infinite;">
          <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
        </svg>
      </div>
      <div style="display: flex; flex-direction: column; gap: 2px;">
        <span style="font-weight: 600; color: #3b82f6;">JPM</span>
        <span style="color: rgba(255, 255, 255, 0.8); font-size: 13px;">
          Saving job...
        </span>
      </div>
    </div>
    <style>
      @keyframes jpm-slide-in {
        from { opacity: 0; transform: translateX(100px); }
        to { opacity: 1; transform: translateX(0); }
      }
      @keyframes jpm-spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
      }
    </style>
  `;

  document.body.appendChild(toast);
}

/**
 * Combined notification function - shows toast + badge + optional chrome notification
 * @param {number} tabId - Tab ID to inject toast
 * @param {string} message - Message to display
 * @param {boolean} isError - Whether this is an error
 */
async function showFeedback(tabId, message, isError = false) {
  // 1. Badge on icon
  await showTemporaryBadge(
    isError ? '✗' : '✓',
    isError ? '#ef4444' : '#22c55e',
    3000
  );

  // 2. Toast in page (most visible)
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      func: injectToast,
      args: [message, isError],
    });
  } catch (e) {
    console.error('Could not inject toast:', e);
  }

  // 3. Chrome notification (backup)
  showChromeNotification(isError ? 'JPM ✗' : 'JPM ✓', message, isError);
}

/**
 * Show loading state
 * @param {number} tabId - Tab ID
 */
async function showLoading(tabId) {
  // Badge
  await setBadge('...', '#3b82f6');

  // Toast in page
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      func: injectLoadingToast,
    });
  } catch (e) {
    console.error('Could not inject loading toast:', e);
  }
}

// ============================================================
// LinkedIn Scraping Function (runs in page context)
// ============================================================

/**
 * This function is injected into the LinkedIn page to scrape job data.
 * It runs in the context of the page, so it has access to the DOM.
 * @returns {Object} Scraped job data
 */
function scrapeLinkedInJobPage() {
  const data = {
    platform_name: 'linkedin',
    url: window.location.href,
    job_title: null,
    company_name: null,
    location_text: null,
    job_badges: [], // Badges like Salary, Remote, Full-time
    raw_text: null,
  };

  // Remove JPM toast if exists (cleanup before scraping)
  const existingToast = document.getElementById('jpm-toast');
  if (existingToast) {
    existingToast.remove();
  }

  // ---- Job Title ----
  const titleSelectors = [
    '.job-details-jobs-unified-top-card__job-title h1.t-24.t-bold',
    'h1.t-24.t-bold.inline',
    '.t-24.job-details-jobs-unified-top-card__job-title h1',
    'h1.job-details-jobs-unified-top-card__job-title',
    'h1.topcard__title',
    'h1.jobs-unified-top-card__job-title',
    '.job-details-jobs-unified-top-card__job-title h1',
    'h1[data-test-job-title]',
    '.jobs-details__main-content h1',
  ];

  for (const selector of titleSelectors) {
    const el = document.querySelector(selector);
    if (el && el.textContent.trim()) {
      data.job_title = el.textContent.trim();
      break;
    }
  }

  // ---- Company Name ----
  const companySelectors = [
    '.job-details-jobs-unified-top-card__company-name a',
    '.job-details-jobs-unified-top-card__company-name',
    '.topcard__org-name-link',
    '.jobs-unified-top-card__company-name a',
    '.jobs-unified-top-card__company-name',
    'a[data-tracking-control-name="public_jobs_topcard-org-name"]',
    '.jobs-details__main-content .jobs-unified-top-card__subtitle-primary-grouping a',
    '.artdeco-entity-lockup__subtitle span',
  ];

  for (const selector of companySelectors) {
    const el = document.querySelector(selector);
    if (el && el.textContent.trim()) {
      data.company_name = el.textContent.trim();
      break;
    }
  }

  // ---- Location ----
  // Location in LinkedIn is usually in the first .tvm__text--low-emphasis span within tertiary-description-container
  const locationSelectors = [
    '.job-details-jobs-unified-top-card__tertiary-description-container .tvm__text--low-emphasis:first-of-type',
    '.job-details-jobs-unified-top-card__tertiary-description-container > span > .tvm__text:first-child',
    '.job-details-jobs-unified-top-card__primary-description-container .tvm__text:first-of-type',
    '.job-details-jobs-unified-top-card__bullet',
    '.topcard__flavor--bullet',
    '.jobs-unified-top-card__bullet',
    '.jobs-unified-top-card__workplace-type',
    '.jobs-details__main-content .jobs-unified-top-card__subtitle-secondary-grouping span',
  ];

  for (const selector of locationSelectors) {
    const el = document.querySelector(selector);
    if (el && el.textContent.trim()) {
      const text = el.textContent.trim().replace(/\s+/g, ' ');
      // Take if it doesn't start with "· " and is a meaningful location
      if (text && !text.startsWith('·') && text.length > 2) {
        data.location_text = text;
        break;
      }
    }
  }

  // ---- Job Badges (Salary, Remote, Full-time, etc.) ----
  const badgeContainerSelectors = [
    '.job-details-fit-level-preferences',
    '.jobs-unified-top-card__job-insight',
  ];

  for (const containerSelector of badgeContainerSelectors) {
    const container = document.querySelector(containerSelector);
    if (container) {
      // Find each button/badge
      const buttons = container.querySelectorAll('button');
      buttons.forEach((btn) => {
        // Get text inside strong, clean icons and hidden text
        const strongEl = btn.querySelector('strong');
        if (strongEl) {
          // Get only visible text with innerText, clean icon characters
          let text = strongEl.innerText.trim().replace(/\s+/g, ' ');
          // Clean check mark and similar characters
          text = text.replace(/^[\s✓✔]+/, '').trim();
          if (text && text.length > 0) {
            data.job_badges.push(text);
          }
        }
      });
      if (data.job_badges.length > 0) break;
    }
  }

  // ---- Raw Text (Job Description) ----
  const descriptionSelectors = [
    '#job-details',
    '.jobs-box__html-content',
    '.jobs-description__content',
    '.jobs-description-content__text',
    '.description__text',
    '.show-more-less-html__markup',
    '.jobs-description',
    '[data-job-description]',
  ];

  for (const selector of descriptionSelectors) {
    const el = document.querySelector(selector);
    if (el && el.innerText.trim()) {
      data.raw_text = el.innerText.trim();
      break;
    }
  }

  // Fallback - get only from job-details main content, not from the entire body
  if (!data.raw_text) {
    const mainContent =
      document.querySelector('.jobs-details__main-content') ||
      document.querySelector('.scaffold-layout__detail') ||
      document.querySelector('main');
    if (mainContent) {
      data.raw_text = mainContent.innerText.trim().substring(0, 50000);
    }
  }

  return data;
}

// ============================================================
// Data Validation
// ============================================================

/**
 * Validate scraped data to ensure we have meaningful content
 * @param {Object} data - Scraped data object
 * @returns {Object} { valid: boolean, message: string, reason: string }
 */
function validateScrapedData(data) {
  // 1. Job title check - must exist
  if (!data.job_title || data.job_title.trim() === '') {
    return {
      valid: false,
      message: 'Job title not found. Is the page fully loaded?',
      reason: 'missing_job_title',
    };
  }

  // 2. Raw text check - must not be empty
  if (!data.raw_text || data.raw_text.trim() === '') {
    return {
      valid: false,
      message: 'Job content not found.',
      reason: 'missing_raw_text',
    };
  }

  // 3. Raw text minimum length check
  const rawTextLength = data.raw_text.trim().length;
  if (rawTextLength < 200) {
    return {
      valid: false,
      message: 'Job content is too short. Is the page fully loaded?',
      reason: 'raw_text_too_short',
    };
  }

  // 4. Raw text meaningful content check - must contain job-specific keywords
  const jobRelatedKeywords = [
    'about',
    'job',
    'role',
    'responsibilities',
    'requirements',
    'qualifications',
    'experience',
    'skills',
    'apply',
    'position',
    'position',
    'work',
    'team',
    'company',
  ];

  const rawTextLower = data.raw_text.toLowerCase();
  const hasJobContent = jobRelatedKeywords.some((keyword) =>
    rawTextLower.includes(keyword)
  );

  if (!hasJobContent) {
    return {
      valid: false,
      message: 'Valid job content not found. Is the page fully loaded?',
      reason: 'no_job_content',
    };
  }

  // 5. Known invalid content check (toast messages, notification counts, etc.)
  const invalidPatterns = [
    /^[\d\s]*notification/i,
    /^Saving job/i,
    /^JPM/,
    /^loading/i,
  ];

  const firstLine = data.raw_text.split('\n')[0].trim();
  for (const pattern of invalidPatterns) {
    if (pattern.test(firstLine)) {
      return {
        valid: false,
        message:
          'Page content could not be read properly. Refresh the page and try again.',
        reason: 'invalid_content_pattern',
      };
    }
  }

  return { valid: true, message: '', reason: '' };
}

// ============================================================
// Main Action Handler
// ============================================================

/**
 * Handle the extension icon click
 * @param {chrome.tabs.Tab} tab - The current tab
 */
async function handleActionClick(tab) {
  // 1. Verify we're on a LinkedIn job page
  if (!tab.url || !isLinkedInJobPage(tab.url)) {
    await showFeedback(
      tab.id,
      'This page is not a LinkedIn job posting.',
      true
    );
    return;
  }

  try {
    // 2. Scrape FIRST (BEFORE loading toast - so toast content is not included in raw_text)
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: scrapeLinkedInJobPage,
    });

    if (!results || results.length === 0 || !results[0].result) {
      await showFeedback(tab.id, 'Page content could not be read.', true);
      return;
    }

    const scrapedData = results[0].result;

    // Debug: Log scraped data
    console.log('JPM Scraped Data:', scrapedData);

    // 3. Validate scraped data - stop process if critical fields are missing
    const validationResult = validateScrapedData(scrapedData);
    if (!validationResult.valid) {
      console.error(
        'JPM Validation Error:',
        validationResult.reason,
        scrapedData
      );
      await showFeedback(tab.id, validationResult.message, true);
      return;
    }

    // NOW show loading toast (after validation passes)
    await showLoading(tab.id);

    // 4. Send data to the backend
    const response = await fetch(CONFIG.API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-jpm-extension-token': CONFIG.SHARED_SECRET,
      },
      body: JSON.stringify(scrapedData),
    });

    const responseData = await response.json();

    // 5. Handle response
    if (response.ok && responseData.success) {
      const title = scrapedData.job_title
        ? scrapedData.job_title.substring(0, 40)
        : 'Job';
      await showFeedback(tab.id, `"${title}" saved!`);
    } else if (response.status === 409 && responseData.duplicate) {
      await showFeedback(tab.id, 'This job is already saved.', true);
    } else if (response.status === 401) {
      await showFeedback(tab.id, 'Authorization error. Check token.', true);
      console.error('JPM Auth Error:', responseData);
    } else {
      await showFeedback(tab.id, responseData.error || 'Unknown error', true);
      console.error('JPM Error:', responseData);
    }
  } catch (error) {
    console.error('JPM Extension Error:', error);

    if (error.message.includes('fetch')) {
      await showFeedback(tab.id, 'Could not connect to backend.', true);
    } else {
      await showFeedback(tab.id, error.message, true);
    }
  }
}

// ============================================================
// Event Listeners
// ============================================================

chrome.action.onClicked.addListener(handleActionClick);

console.log('JPM Extension service worker started');
