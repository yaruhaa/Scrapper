const fs = require('fs');
const { MongoClient } = require('mongodb');

async function main() {
    const uri = 'mongodb://localhost:27017';
    const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });

    try {
        await client.connect();
        const db = client.db('shop');
        const historyCollection = db.collection('Історія');

        // Читання даних з файлу group_products.json
        const data = JSON.parse(fs.readFileSync('D:\\KHPI\\Graduate work\\group\\group_products.json', 'utf8'));

        // Обробка кожної категорії з даних
        for (const [category, subcategories] of Object.entries(data)) {
            const collection = db.collection(category);

            const newProducts = []; // Массив для нових продуктів
            for (const subcategory of subcategories) {
                const groupName = Object.keys(subcategory)[0];
                const products = subcategory[groupName];
                newProducts.push(...products.map(productGroup => ({
                    ...productGroup.MainInfo,
                    groupName
                })));
            }

            // Отримання існуючих продуктів з бази даних
            const existingProducts = await collection.find().toArray();

            // Створення фільтрів для нових продуктів
            const newProductFilters = newProducts.map(product => ({
                type: product.type,
                firm: product.firm,
                flavor: product.flavor,
                weight: product.weight,
                groupName: product.groupName
            }));

            // Оновлення або вставка нових продуктів
            for (const product of newProducts) {
                const filter = {
                    type: product.type,
                    firm: product.firm,
                    flavor: product.flavor,
                    weight: product.weight,
                    groupName: product.groupName
                };

                const existingProduct = await collection.findOne(filter); // Перевірка наявності продукту в базі даних

                if (existingProduct) {
                    console.log(`Updating product: ${JSON.stringify(product)}`);
                    await collection.updateOne(filter, { $set: product });
                } else {
                    console.log(`Inserting new product: ${JSON.stringify(product)}`);
                    await collection.insertOne(product);
                }

                // Вставка історії цін для кожного магазину
                for (const storeInfo of product.OtherInfo) {
                    const historyFilter = {
                        type: product.type,
                        firm: product.firm,
                        flavor: product.flavor,
                        weight: product.weight,
                        groupName: product.groupName,
                        storeName: storeInfo.storeName
                    };

                    const historyEntry = {
                        ...historyFilter,
                        date: new Date(),
                        price: storeInfo.productPrice
                    };

                    console.log(`Inserting price history: ${JSON.stringify(historyEntry)}`);
                    await historyCollection.insertOne(historyEntry);
                }
            }

            // Видалення продуктів, яких більше немає в нових даних
            for (const product of existingProducts) {
                if (!newProductFilters.some(filter =>
                    filter.type === product.type &&
                    filter.firm === product.firm &&
                    filter.flavor === product.flavor &&
                    filter.weight === product.weight &&
                    filter.groupName === product.groupName
                )) {
                    console.log(`Deleting product: ${JSON.stringify(product)}`);
                    await collection.deleteOne({ _id: product._id });
                }
            }
        }

        console.log('Database updated successfully.');
    } catch (err) {
        console.error(err);
    } finally {
        await client.close();
    }
}
main().catch(console.error);