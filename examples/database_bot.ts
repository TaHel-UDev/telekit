import { TeleKit, LocalDB, Keyboard } from '../src';

// 1. Инициализируем бота и базу данных
const bot = new TeleKit(process.env.BOT_TOKEN || '');

// База данных товаров (хранится в products.json)
interface Product {
    id: number;
    name: string;
    price: number;
}
const db = new LocalDB<Product>('products.json');

// Заполним базу при старте, если пустая
if (db.getAll().length === 0) {
    db.push({ id: 1, name: '🍎 Яблоко', price: 100 });
    db.push({ id: 2, name: '🍌 Банан', price: 150 });
    db.push({ id: 3, name: '🍒 Вишня', price: 300 });
}

// 2. Логика магазина

bot.command('start', async (ctx) => {
    await ctx.reply('Добро пожаловать в магазин фруктов! 🍎');
    await sendCatalog(ctx);
});

async function sendCatalog(ctx: any) {
    // Получаем все товары из базы
    const products = db.getAll();

    // Генерируем кнопки для каждого товара
    const buttons = products.map(p =>
        [Keyboard.callback(`${p.name} - ${p.price}₽`, `buy_${p.id}`)]
    );

    await ctx.reply('Что хотите купить?', {
        reply_markup: Keyboard.inline(buttons)
    });
}

// Обрабатываем нажатие "Купить" (buy_1, buy_2 ...)
bot.onCallback(/^buy_(\d+)$/, async (ctx) => {
    const productId = Number(ctx.callbackData?.split('_')[1]);

    // Ищем товар в базе
    const product = await db.findOne(p => p.id === productId);

    if (product) {
        await ctx.answerCallback(`Вы выбрали: ${product.name}`);
        await ctx.reply(`✅ Вы успешно купили ${product.name} за ${product.price}₽`);
    } else {
        await ctx.answerCallback('Товар не найден', true);
    }
});

// Админская команда: Добавить товар
// Пример: /add 🍐 Груша-200
bot.onText(/^\/add (.+)-(\d+)$/, async (ctx) => {
    // Парсим ввод (Регулярные выражения - это мощь!)
    const match = ctx.text?.match(/^\/add (.+)-(\d+)$/);
    if (!match) return;

    const name = match[1];
    const price = Number(match[2]);

    // Сохраняем в базу LocalDB
    await db.push({
        id: Date.now(), // Генерируем ID
        name,
        price
    });

    await ctx.reply(`Добавлен товар: ${name} за ${price}₽`);
});

bot.start();
