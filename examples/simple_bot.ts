import { TeleKit, Keyboard } from '../src';

const bot = new TeleKit(process.env.BOT_TOKEN || '');

// Меню
bot.setCommands([{ command: 'start', description: 'Запустить' }]);

bot.command('start', (ctx) => {
    ctx.reply('Привет! Это самый простой бот.', {
        reply_markup: Keyboard.reply(['Покажи котика'])
    })
});

bot.onText('Покажи котика', (ctx) => {
    ctx.reply('🐈 Мяу!');
});

bot.start();
