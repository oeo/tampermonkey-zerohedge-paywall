// ==UserScript==
// @name         Zerohedge Paywall Remover
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  Automatically decode Base64 articles on Zerohedge
// @match        *://www.zerohedge.com/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    function decodeBase64(encodedString) {
        return atob(encodedString);
    }

    function isValidBase64(string) {
        let pattern = /^[A-Za-z0-9+/]*={0,2}$/;
        return pattern.test(string) && string.length % 4 === 0;
    }

    function filterInvalidCharacters(decodedString) {
        return decodedString.replace(/[^\x20-\x7E]/g, '').trim().substr(5);
    }

    function waitForElement(selector, timeout = 5000) {
        return new Promise((resolve, reject) => {
            const interval = 100;
            let timeElapsed = 0;

            const checkExist = setInterval(() => {
                const element = document.querySelector(selector);
                if (element) {
                    clearInterval(checkExist);
                    resolve(element);
                }
                timeElapsed += interval;
                if (timeElapsed >= timeout) {
                    clearInterval(checkExist);
                    reject(new Error('Element not found'));
                }
            }, interval);
        });
    }

    async function extractAndDecodeArticle() {
        console.log("Starting to extract and decode article...");

        let scriptTags = document.querySelectorAll('script[type="application/json"]');
        let articleContent = '';

        for (let scriptTag of scriptTags) {
            let jsonData;
            try {
                jsonData = JSON.parse(scriptTag.innerHTML);
            } catch (error) {
                console.warn(`Failed to parse JSON for script tag: ${error}`);
                continue;
            }

            console.log(`Processing script tag`);

            if (!jsonData.props?.pageProps?.node) continue;

            let articleData = jsonData.props.pageProps.node.body;

            while (articleData.length > 0) {
                if (!isValidBase64(articleData)) {
                    articleData = articleData.substring(1);
                    continue;
                }

                console.log("Found Base64 encoded article. Decoding...");
                try {
                    let decodedContent = decodeBase64(articleData);
                    if (/<[^>]+>/.test(decodedContent)) {
                        articleContent = filterInvalidCharacters(decodedContent);
                        console.log("Valid HTML content detected. Waiting for main content...");

                        try {
                            let mainContentDiv = await waitForElement('.main-content');
                            mainContentDiv.innerHTML = `<h1>Decoded: ${document.title.split('|')[0]}</h1><br/>${articleContent}`;
                        } catch (err) {
                            console.error(err.message);
                        }
                        break;
                    }
                } catch (decodeError) {
                    console.error(`Error decoding Base64 string: ${decodeError}`);
                    return;
                }
                articleData = articleData.substring(1);
            }

            scriptTag.dataset.processed = "true";
        }

        if (!articleContent) {
            console.log("No decoded content available.");
        }
    }

    window.addEventListener('load', extractAndDecodeArticle);
})();

