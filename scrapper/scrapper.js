const fs = require('fs');
const puppeteer = require('puppeteer');
const path = require('path');

// Список файлів з даними магазинів
const storeFiles = ['./Stores/fozzy.json', './Stores/ecomarket.json', './Stores/auchan.json', './Stores/cosmos.json', './Stores/atb.json', './Stores/metro.json', './Stores/rost.json', './Stores/zaraz.json'];

// Функція завантаження даних магазину з файлу
const loadStoreData = (filePath) => {
    const data = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(data);
};

// Функція перевірки верифікації віку
async function checkAgeVerification(page, ageVerificationSelector) {
    try {
        const ageVerificationButton = await page.$(ageVerificationSelector);
        if (ageVerificationButton) {
            const isClickable = await page.evaluate((btn) => {
                const rect = btn.getBoundingClientRect();
                return (
                    rect.width > 0 &&
                    rect.height > 0 &&
                    window.getComputedStyle(btn).visibility !== 'hidden'
                );
            }, ageVerificationButton);

            if (isClickable) {
                await ageVerificationButton.click();
                if (page.url().includes('fozzy')) {
                    await page.waitForNavigation();
                }
            }
        }
    } catch (error) {
        console.error('Error during age verification:', error);
    }
}

// Функція для скрапінгу даних
const scrape = async (selectors, category) => {
    const browser = await puppeteer.launch({
        headless: false
    });

    const categoryPage = await browser.newPage();

    let pageUrl = selectors.url;
    let products = [];
    let currentPage = 1;
    let previousProducts = [];
    const isRost = pageUrl.includes('rost.kh.ua');
    const isFozzy = pageUrl.includes('fozzyshop.ua');
    let ageVerified = false;

    while (true) {
        // Формування URL для поточної сторінки
        const currentPageUrl = isRost
            ? `${pageUrl}&page=${currentPage * 20}`
            : isFozzy
                ? `${pageUrl.split('?')[0]}?${pageUrl.split('?')[1].split('&').filter(param => !param.startsWith('page')).join('&')}&page=${currentPage}`
                : `${pageUrl}?page=${currentPage}`;

        await categoryPage.goto(currentPageUrl, { waitUntil: 'domcontentloaded' });
        const currentUrl = categoryPage.url();

        if (currentUrl !== currentPageUrl) {
            break;
        }

        const isPageValid = await categoryPage.evaluate((selectors) => {
            return document.querySelector(selectors.productSelector) !== null;
        }, selectors);

        if (!isPageValid) {
            break;
        }

        if (!ageVerified) {
            await checkAgeVerification(categoryPage, selectors.ageVerificationSelector);
            ageVerified = true;
        }

        // Витягування даних про продукти зі сторінки
        const result = await categoryPage.evaluate((selectors) => {
            let data = [];
            let elements = document.querySelectorAll(selectors.productSelector);

            for (let element of elements) {
                let productNameElement = element.querySelector(selectors.productNameSelector);
                let productImgElement = element.querySelector(selectors.productImgSelector);
                let productPriceElement = element.querySelector(selectors.productPriceSelector);
                let productDiscountPriceElementBefore = element.querySelector(selectors.productDiscountPriceSelectorBefore);
                let productDiscountPriceElementAfter = element.querySelector(selectors.productDiscountPriceSelectorAfter);

                // Перевірка, чи всі необхідні елементи присутні
                if (productNameElement && productImgElement && (productPriceElement || (productDiscountPriceElementBefore && productDiscountPriceElementAfter))) {
                    let productName = productNameElement.innerText;
                    let storeName = selectors.storeName;
                    let productImg = productImgElement.src;
                    let productLink = productNameElement.href;
                    let productPrice, productDiscountPrice;

                    if (productDiscountPriceElementBefore && productDiscountPriceElementAfter) {
                        productPrice = productDiscountPriceElementAfter.innerText.trim();
                        productDiscountPrice = productDiscountPriceElementBefore.innerText.trim();
                    } else if (productPriceElement) {
                        productPrice = productPriceElement.innerText.trim();
                    }

                    data.push({ productName, storeName, productImg, productLink, productPrice, productDiscountPrice });
                }
            }
            return data;
        }, selectors);

        if (JSON.stringify(result) === JSON.stringify(previousProducts)) {
            break;
        }

        products = products.concat(result);
        previousProducts = result;

        currentPage++;
    }

    await browser.close();
    return products;
};

(async () => {
    try {
        const categorizedProducts = {};

        for (const filePath of storeFiles) {
            const store = loadStoreData(filePath);
            const storeName = path.basename(filePath, '.json');
            for (const section of store.Sections) {
                for (const sectionName in section) {
                    const categories = section[sectionName].Categories;
                    for (const category of categories) {
                        for (const categoryName in category) {
                            const categoryLinks = category[categoryName];
                            const urls = Array.isArray(categoryLinks) ? categoryLinks : [categoryLinks];
                            for (const url of urls) {
                                const selectors = { ...store.storeInfo, url };
                                const products = await scrape(selectors, categoryName);

                                if (!categorizedProducts[sectionName]) {
                                    categorizedProducts[sectionName] = {};
                                }
                                if (!categorizedProducts[sectionName][categoryName]) {
                                    categorizedProducts[sectionName][categoryName] = [];
                                }
                                categorizedProducts[sectionName][categoryName].push(...products);
                            }
                        }
                    }
                }
            }
        }

        fs.writeFileSync('products.json', JSON.stringify(categorizedProducts, null, 2), 'utf-8');

        console.log('Products saved to products.json');
    } catch (error) {
        console.error('An error occurred:', error);
    }
})();
