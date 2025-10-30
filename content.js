// YouTube書き起こしダウンロード拡張機能
(function () {
  'use strict';

  // 動画IDを取得
  function getVideoId() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('v');
  }

  // 動画タイトルを取得
  function getVideoTitle() {
    const titleElement = document.querySelector(
      'h1.ytd-watch-metadata yt-formatted-string, h1.title yt-formatted-string'
    );
    return titleElement ? titleElement.textContent.trim() : 'youtube_transcript';
  }

  // 文字起こしパネルが開いているか確認
  function isTranscriptPanelOpen() {
    // 文字起こしパネルのセレクタ（複数の可能性を試す）
    const selectors = [
      'ytd-transcript-renderer',
      '[id="transcript"]',
      '#transcript-container',
      '.ytd-transcript-renderer',
    ];

    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element && element.offsetParent !== null) {
        return true;
      }
    }
    return false;
  }

  // 文字起こしパネルを開く
  async function openTranscriptPanel() {
    // 方法1: 直接「文字起こしを表示」ボタンを探す
    const transcriptButton = document.querySelector(
      'ytd-video-description-transcript-section-renderer button[aria-label="文字起こしを表示"], button[aria-label*="文字起こしを表示"], button[aria-label*="Show transcript"]'
    );

    if (transcriptButton) {
      transcriptButton.click();
      await new Promise((resolve) => setTimeout(resolve, 1500));
      return true;
    }

    // 方法2: より広範囲でボタンを探す
    const buttonSelectors = [
      'ytd-video-description-transcript-section-renderer #primary-button button',
      'ytd-video-description-transcript-section-renderer ytd-button-renderer button',
      '#button-container #primary-button button',
    ];

    for (const selector of buttonSelectors) {
      const button = document.querySelector(selector);
      if (button) {
        const text = button.textContent || button.getAttribute('aria-label') || '';
        if (text.includes('文字起こし') || text.includes('transcript')) {
          button.click();
          await new Promise((resolve) => setTimeout(resolve, 1500));
          return true;
        }
      }
    }

    // 方法3: 以前の方法（フォールバック）
    // 文字起こしを開くボタンを探す
    const menuButton = document.querySelector(
      'button[aria-label*="さらに表示"], button[aria-label*="More actions"], ytd-menu-renderer button'
    );
    if (menuButton) {
      menuButton.click();
      await new Promise((resolve) => setTimeout(resolve, 500));

      // 「文字起こしを表示」または「Show transcript」を探す
      const transcriptMenuItem = Array.from(
        document.querySelectorAll(
          'ytd-menu-service-item-renderer, tp-yt-paper-listbox > ytd-menu-service-item-renderer'
        )
      ).find((item) => {
        const text = item.textContent.toLowerCase();
        return text.includes('文字起こし') || text.includes('transcript');
      });

      if (transcriptMenuItem) {
        transcriptMenuItem.click();
        await new Promise((resolve) => setTimeout(resolve, 1000));
        return true;
      }
    }

    return false;
  }

  // テキストを整形・クリーンアップする
  function cleanTranscriptText(text) {
    if (!text) return '';

    // 1. UI要素を除去
    const uiPatterns = [
      /^オープニング\s+/i,
      /\[音楽\]/g,
      /タップして再試行.*$/,
      /日本語\s*\(自動生成\)/i,
      /^\d+:\d+\s*/gm, // タイムスタンプ
    ];

    let cleaned = text;
    uiPatterns.forEach((pattern) => {
      cleaned = cleaned.replace(pattern, '');
    });

    // 2. 余分な空白を整理（最初に実行）
    cleaned = cleaned.replace(/\s+/g, ' ');

    // 3. 重複テキストの除去（より効果的な方法）
    // まず、改行を含む長いパターンで重複を検出
    // 改行で分割して、各行が重複しているかチェック
    const lines = cleaned.split(/\n/);
    const deduplicatedLines = [];
    let lineIndex = 0;

    while (lineIndex < lines.length) {
      const currentLine = lines[lineIndex].trim();

      // 同じ行が3回連続で出現しているかチェック
      if (
        lineIndex + 2 < lines.length &&
        currentLine === lines[lineIndex + 1].trim() &&
        currentLine === lines[lineIndex + 2].trim() &&
        currentLine.length > 20
      ) {
        // 3回繰り返されている場合は1回だけ追加
        deduplicatedLines.push(currentLine);
        lineIndex += 3;
      } else if (
        lineIndex + 1 < lines.length &&
        currentLine === lines[lineIndex + 1].trim() &&
        currentLine.length > 20
      ) {
        // 2回繰り返されている場合も1回だけ追加
        deduplicatedLines.push(currentLine);
        lineIndex += 2;
      } else {
        deduplicatedLines.push(currentLine);
        lineIndex += 1;
      }
    }

    cleaned = deduplicatedLines.join(' ');

    // 次に、語単位で長いパターンの重複を検出
    const segments = cleaned.split(/\s+/);
    const deduplicatedSegments = [];
    let i = 0;

    while (i < segments.length) {
      let found = false;
      let maxMatch = 0;

      // より長いパターンから検出（100語、80語、60語、40語、30語、20語、10語、5語の順）
      const patternLengths = [100, 80, 60, 40, 30, 20, 10, 5];

      for (const patternLength of patternLengths) {
        if (i + patternLength * 2 < segments.length) {
          const pattern = segments.slice(i, i + patternLength).join(' ');
          const nextPattern = segments.slice(i + patternLength, i + patternLength * 2).join(' ');
          const thirdPattern = segments
            .slice(i + patternLength * 2, i + patternLength * 3)
            .join(' ');

          // パターンが完全に一致し、かつ十分な長さがある場合
          if (pattern === nextPattern && pattern === thirdPattern && pattern.length > 20) {
            maxMatch = patternLength;
            found = true;
            break;
          }
        }
      }

      if (found && maxMatch > 0) {
        // 重複が見つかった場合は1回だけ追加
        deduplicatedSegments.push(...segments.slice(i, i + maxMatch));
        i += maxMatch * 3; // 3回分をスキップ
      } else {
        deduplicatedSegments.push(segments[i]);
        i += 1;
      }
    }

    cleaned = deduplicatedSegments.join(' ');

    // 4. 追加の重複検出（文単位）- 改善版
    // 同じ文が3回連続で出現している場合を検出
    // より積極的に重複を除去
    const sentences = cleaned.split(/[。！？\.\!?]/).filter((s) => s.trim().length > 0);
    const uniqueSentences = [];
    let j = 0;

    while (j < sentences.length) {
      const currentSentence = sentences[j].trim();

      // 現在の文が3回連続で繰り返されているかチェック
      if (
        j + 2 < sentences.length &&
        currentSentence === sentences[j + 1].trim() &&
        currentSentence === sentences[j + 2].trim() &&
        currentSentence.length > 5 // より短い文も検出
      ) {
        // 3回繰り返されている場合は1回だけ追加
        uniqueSentences.push(currentSentence);
        j += 3; // 3回分をスキップ
      } else {
        // 2回繰り返されている場合も1回だけ追加
        if (
          j + 1 < sentences.length &&
          currentSentence === sentences[j + 1].trim() &&
          currentSentence.length > 5 // より短い文も検出
        ) {
          uniqueSentences.push(currentSentence);
          j += 2;
        } else {
          uniqueSentences.push(currentSentence);
          j += 1;
        }
      }
    }

    cleaned = uniqueSentences.join('。');

    // 5. 追加の重複検出: 文字列全体での重複パターン検出
    // 同じ文字列が複数回出現している場合を検出（より積極的に）
    const textChunks = cleaned.split(/\s+/);
    const finalChunks = [];
    let k = 0;

    while (k < textChunks.length) {
      let duplicateFound = false;

      // 20語以上のパターンで重複を検出
      for (let chunkSize = Math.min(50, textChunks.length - k); chunkSize >= 20; chunkSize -= 5) {
        if (k + chunkSize * 2 <= textChunks.length) {
          const chunk1 = textChunks.slice(k, k + chunkSize).join(' ');
          const chunk2 = textChunks.slice(k + chunkSize, k + chunkSize * 2).join(' ');

          if (chunk1 === chunk2 && chunk1.length > 30) {
            finalChunks.push(...textChunks.slice(k, k + chunkSize));
            k += chunkSize * 2;
            duplicateFound = true;
            break;
          }
        }
      }

      if (!duplicateFound) {
        finalChunks.push(textChunks[k]);
        k += 1;
      }
    }

    cleaned = finalChunks.join(' ');

    // 6. 短い単語の繰り返しパターンを除去（例：「うん。うん。うん。」→「うん。」）
    cleaned = cleaned.replace(/(うん。\s*){2,}/g, 'うん。');
    cleaned = cleaned.replace(/(はい。\s*){2,}/g, 'はい。');
    cleaned = cleaned.replace(/(はあ。\s*){2,}/g, 'はあ。');
    cleaned = cleaned.replace(/(はいはい。\s*){2,}/g, 'はいはい。');
    cleaned = cleaned.replace(/(なるほど。\s*){2,}/g, 'なるほど。');
    cleaned = cleaned.replace(/(お願いします。\s*){2,}/g, 'お願いします。');
    cleaned = cleaned.replace(/(さん、\s*){2,}/g, 'さん、');

    // 7. 数字の繰り返しパターンを除去（例：「1 1 1」→「1」）
    cleaned = cleaned.replace(/(\d+)\s+\1\s+\1/g, '$1');

    // 8. 句読点の前後の空白を整理
    cleaned = cleaned.replace(/\s+。/g, '。');
    cleaned = cleaned.replace(/\s+、/g, '、');
    cleaned = cleaned.replace(/\s+？/g, '？');
    cleaned = cleaned.replace(/\s+！/g, '！');

    // 9. 改行を適切に追加（文の終わりで改行）
    cleaned = cleaned.replace(/。/g, '。\n');
    cleaned = cleaned.replace(/\?\s*/g, '?\n');
    cleaned = cleaned.replace(/!\s*/g, '!\n');
    cleaned = cleaned.replace(/？/g, '？\n');
    cleaned = cleaned.replace(/！/g, '！\n');

    // 10. 連続する改行を2つまでに制限
    cleaned = cleaned.replace(/\n{3,}/g, '\n\n');

    // 11. 先頭・末尾の空白・改行を除去
    cleaned = cleaned.trim();

    return cleaned;
  }

  // 文字起こしパネルからテキストを取得
  function extractTranscriptText() {
    // 文字起こしパネルのセレクタ（複数の可能性を試す）
    const selectors = [
      'ytd-transcript-renderer',
      '[id="transcript"]',
      '#transcript-container',
      '.ytd-transcript-renderer',
    ];

    for (const selector of selectors) {
      const panel = document.querySelector(selector);
      if (panel && panel.offsetParent !== null) {
        // 文字起こしのエントリを探す（セグメントごとに取得）
        // より正確なセレクタでセグメントを取得
        const transcriptSegments = panel.querySelectorAll('ytd-transcript-segment-renderer');

        if (transcriptSegments.length > 0) {
          const segments = [];
          const seenTexts = new Set(); // 重複を防ぐためのSet

          transcriptSegments.forEach((segment) => {
            // より正確にテキストを取得
            const textElement = segment.querySelector('yt-formatted-string.segment-text');
            let segmentText = '';

            if (textElement) {
              segmentText = textElement.textContent.trim();
            } else {
              // フォールバック: segment全体からテキストを取得
              segmentText = segment.textContent.trim();

              // タイムスタンプやセクションヘッダーのテキストを除去
              // セクションヘッダーは通常、h2要素や特定の構造を持っている
              const headerElement = segment.querySelector('h2, .yt-shelf-header-layout__title');
              if (headerElement) {
                const headerText = headerElement.textContent.trim();
                segmentText = segmentText.replace(headerText, '').trim();
              }
            }

            if (segmentText) {
              // タイムスタンプを除去（より正確に）
              segmentText = segmentText.replace(/^\d+:\d+.*?(\s|$)/, '').trim();
              segmentText = segmentText.replace(/^\d+\s*(分|秒)/, '').trim();

              // UI要素やセクションヘッダーのテキストを除外
              if (
                /^オープニング|\[音楽\]|タップして再試行|日本語\s*\(自動生成\)|社長が役員に感じる|なぜその行動が|社長の本音と幹部育成|ゲームが違う/i.test(
                  segmentText
                )
              ) {
                return;
              }

              // 単一文字や数字のみのセグメントを除外
              if (segmentText.length <= 1 || /^[\dA-Z]$/.test(segmentText)) {
                return;
              }

              // 重複を防ぐ（同じテキストが既に追加されている場合はスキップ）
              if (segmentText.length > 2 && !seenTexts.has(segmentText)) {
                segments.push(segmentText);
                seenTexts.add(segmentText);
              }
            }
          });

          if (segments.length > 0) {
            // 配列を結合
            let text = segments.join(' ');

            // テキストを整形
            text = cleanTranscriptText(text);

            return text;
          }
        }

        // 別の方法: パネル全体からテキストを取得
        const allText = panel.innerText || panel.textContent;
        if (allText && allText.length > 50) {
          // タイムスタンプやUI要素を除去
          let cleanText = allText
            .split('\n')
            .filter((line) => {
              const trimmed = line.trim();
              // タイムスタンプのパターンを除外
              if (/^\d+:\d+/.test(trimmed)) return false;
              // UI要素を除外
              if (/^オープニング|\[音楽\]|タップして再試行|日本語\s*\(自動生成\)/i.test(trimmed))
                return false;
              return trimmed.length > 0;
            })
            .map((line) => line.trim())
            .join(' ');

          // テキストを整形
          cleanText = cleanTranscriptText(cleanText);

          return cleanText;
        }
      }
    }

    return null;
  }

  // テキストをダウンロード
  function downloadText(text, filename) {
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // ダウンロードボタンを作成（アイコン形式）
  function createDownloadButton() {
    // ボタンコンテナを作成（YouTubeのボタンと同じ構造）
    const buttonContainer = document.createElement('div');
    buttonContainer.id = 'youtube-transcript-downloader-icon';
    buttonContainer.style.cssText = `
      display: inline-block;
      margin: 0 8px;
      position: relative;
    `;

    const button = document.createElement('button');
    button.setAttribute('aria-label', '文字起こしをダウンロード');
    button.setAttribute('title', '文字起こしをダウンロード');
    button.style.cssText = `
      padding: 8px;
      background: transparent;
      border: none;
      border-radius: 50%;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 40px;
      height: 40px;
      transition: background-color 0.2s;
      color: var(--yt-spec-text-primary, #ffffff);
    `;

    // アイコンSVGを作成（ダウンロードアイコン）
    const iconSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    iconSvg.setAttribute('width', '24');
    iconSvg.setAttribute('height', '24');
    iconSvg.setAttribute('viewBox', '0 0 24 24');
    iconSvg.setAttribute('fill', 'none');
    iconSvg.style.cssText = 'pointer-events: none; display: inherit; width: 100%; height: 100%;';

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', 'M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z');
    path.setAttribute('fill', 'currentColor');
    iconSvg.appendChild(path);

    button.appendChild(iconSvg);

    // ホバー時のスタイル
    button.addEventListener('mouseenter', () => {
      button.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
    });

    button.addEventListener('mouseleave', () => {
      button.style.backgroundColor = 'transparent';
    });

    // ツールチップを作成
    const tooltip = document.createElement('div');
    tooltip.textContent = '文字起こしをダウンロード';
    tooltip.style.cssText = `
      position: absolute;
      background: rgba(0, 0, 0, 0.8);
      color: white;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 12px;
      white-space: nowrap;
      pointer-events: none;
      opacity: 0;
      transition: opacity 0.2s;
      z-index: 10000;
      top: 100%;
      left: 50%;
      transform: translateX(-50%);
      margin-top: 8px;
    `;
    buttonContainer.appendChild(tooltip);

    // ツールチップの表示/非表示
    button.addEventListener('mouseenter', () => {
      tooltip.style.opacity = '1';
    });

    button.addEventListener('mouseleave', () => {
      tooltip.style.opacity = '0';
    });

    // クリックイベント
    button.addEventListener('click', async () => {
      button.disabled = true;
      button.style.opacity = '0.5';

      try {
        // 文字起こしパネルが開いていない場合は開く
        if (!isTranscriptPanelOpen()) {
          const opened = await openTranscriptPanel();

          if (!opened) {
            alert(
              '文字起こしパネルを開けませんでした。手動で「…」メニューから「文字起こしを表示」を選択してください。'
            );
            button.disabled = false;
            button.style.opacity = '1';
            return;
          }

          // パネルが開くまで少し待つ
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }

        // 文字起こしテキストを取得
        let text = extractTranscriptText();

        // 取得に失敗した場合は少し待って再試行
        if (!text) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
          text = extractTranscriptText();
        }

        if (text && text.length > 10) {
          // URLを取得してテキストの最後に追加
          const videoUrl = window.location.href;
          const textWithUrl = text + '\n\n---\n\n' + videoUrl;

          const videoTitle = getVideoTitle();
          const safeTitle = videoTitle.replace(/[<>:"/\\|?*]/g, '_');
          const filename = `${safeTitle}_transcript.txt`;
          downloadText(textWithUrl, filename);
        } else {
          alert(
            '文字起こしが見つかりませんでした。文字起こしパネルが開いていることを確認してください。'
          );
        }
      } catch (error) {
        alert('エラーが発生しました: ' + error.message);
        console.error('ダウンロードエラー:', error);
      } finally {
        setTimeout(() => {
          button.disabled = false;
          button.style.opacity = '1';
        }, 1000);
      }
    });

    buttonContainer.appendChild(button);
    return buttonContainer;
  }

  // メイン処理
  async function init() {
    const videoId = getVideoId();
    if (!videoId) {
      return;
    }

    // 既にボタンが追加されている場合はスキップ
    if (document.querySelector('#youtube-transcript-downloader-icon')) {
      return;
    }

    // ヘッダーのボタンエリアを探す
    let targetElement = null;
    const headerSelectors = [
      'ytd-masthead #end #buttons',
      'ytd-masthead #buttons',
      '#end #buttons',
      '#buttons',
    ];

    for (const selector of headerSelectors) {
      targetElement = document.querySelector(selector);
      if (targetElement && targetElement.offsetParent !== null) {
        console.log(`ヘッダーボタン配置先を見つけました: ${selector}`);
        break;
      }
    }

    // フォールバック: #end要素を探す
    if (!targetElement) {
      const endElement = document.querySelector('ytd-masthead #end');
      if (endElement) {
        targetElement = endElement;
        console.log('フォールバック: #end要素を使用');
      }
    }

    if (!targetElement) {
      console.warn('ヘッダーボタン配置先が見つかりませんでした。');
      return;
    }

    // アイコンボタンを作成
    const buttonContainer = createDownloadButton();

    // ボタンをヘッダーに追加（通知ボタンの前）
    const notificationButton = targetElement.querySelector(
      'ytd-notification-topbar-button-renderer'
    );
    if (notificationButton) {
      targetElement.insertBefore(buttonContainer, notificationButton);
    } else {
      targetElement.appendChild(buttonContainer);
    }

    console.log('文字起こしダウンロードアイコンボタンをヘッダーに追加しました');
  }

  // ページ読み込み完了後に初期化（複数回試行）
  function tryInit() {
    console.log('拡張機能: 初期化を試行します...');
    init();

    // ボタンが追加されなかった場合は少し待って再試行（複数回）
    let retryCount = 0;
    const maxRetries = 5;

    const retryInterval = setInterval(() => {
      if (!document.querySelector('#youtube-transcript-downloader-icon')) {
        retryCount++;
        console.log(`再試行 ${retryCount}/${maxRetries}: ボタンを追加します`);
        init();

        if (retryCount >= maxRetries) {
          clearInterval(retryInterval);
          console.warn('拡張機能: 最大リトライ回数に達しました');
        }
      } else {
        clearInterval(retryInterval);
        console.log('拡張機能: ボタンが正常に追加されました');
      }
    }, 2000);
  }

  // 初期化を実行
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      console.log('拡張機能: DOMContentLoadedイベント');
      setTimeout(tryInit, 1500);
    });
  } else {
    console.log('拡張機能: ページは既に読み込まれています');
    setTimeout(tryInit, 1500);
  }

  // YouTubeのSPAナビゲーションに対応
  let lastUrl = location.href;
  const urlObserver = new MutationObserver(() => {
    const url = location.href;
    if (url !== lastUrl && url.includes('/watch')) {
      console.log('拡張機能: URLが変更されました:', url);
      lastUrl = url;
      const oldButton = document.querySelector('#youtube-transcript-downloader-icon');
      if (oldButton) {
        oldButton.remove();
      }
      setTimeout(tryInit, 2000);
    }
  });

  urlObserver.observe(document, { subtree: true, childList: true });

  // 定期的にチェック（フォールバック）
  setInterval(() => {
    if (
      location.href.includes('/watch') &&
      !document.querySelector('#youtube-transcript-downloader-icon')
    ) {
      console.log('拡張機能: 定期チェック - ボタンが見つかりません。再試行します');
      tryInit();
    }
  }, 5000);

  // 動画が変更されたときに再初期化
  let currentVideoId = getVideoId();
  const observer = new MutationObserver(() => {
    const newVideoId = getVideoId();
    if (newVideoId && newVideoId !== currentVideoId) {
      currentVideoId = newVideoId;
      const oldButton = document.querySelector('#youtube-transcript-downloader-icon');
      if (oldButton) {
        oldButton.remove();
      }
      setTimeout(() => tryInit(), 1000);
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });
})();
