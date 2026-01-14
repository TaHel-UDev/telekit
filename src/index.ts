import axios, { AxiosInstance } from 'axios';
import { Update, User, InlineKeyboardButton, ReplyKeyboardMarkup, InlineKeyboardMarkup, Message } from 'typegram';
import * as fs from 'fs';
import * as path from 'path';

export * from 'typegram';

// --- Types ---
export type Handler = (ctx: Context) => void | Promise<void>;
export type Middleware = (ctx: Context, next: () => Promise<void>) => Promise<void>;

interface SessionContainer { [key: string]: any; }

// --- 📦 LOCAL DB SYSTEM (Встроенная база) ---

/**
 * Простая, но мощная JSON база данных.
 * Позволяет хранить массивы данных с поиском и фильтрацией.
 */
export class LocalDB<T extends object> {
    private filePath: string;
    private data: T[] = [];

    constructor(filename: string) {
        this.filePath = path.resolve(process.cwd(), filename);
        this.load();
    }

    private load() {
        if (!fs.existsSync(this.filePath)) {
            this.save();
            return;
        }
        try {
            this.data = JSON.parse(fs.readFileSync(this.filePath, 'utf-8'));
        } catch (e) {
            console.error(`Ошибка чтения БД ${this.filePath}:`, e);
            this.data = [];
        }
    }

    private async save() {
        await fs.promises.writeFile(this.filePath, JSON.stringify(this.data, null, 2));
    }

    // --- Public API ---

    /** Добавить запись */
    async push(item: T) {
        this.data.push(item);
        await this.save();
    }

    /** Найти одну запись */
    async findOne(predicate: (item: T) => boolean): Promise<T | null> {
        return this.data.find(predicate) || null;
    }

    /** Найти все подходящие записи */
    async find(predicate: (item: T) => boolean): Promise<T[]> {
        return this.data.filter(predicate);
    }

    /** Обновить запись (находим и меняем поля) */
    async update(predicate: (item: T) => boolean, updates: Partial<T>) {
        const item = this.data.find(predicate);
        if (item) {
            Object.assign(item, updates);
            await this.save();
            return true;
        }
        return false;
    }

    /** Удалить запись */
    async delete(predicate: (item: T) => boolean) {
        const initLength = this.data.length;
        this.data = this.data.filter(item => !predicate(item));
        if (this.data.length !== initLength) await this.save();
    }

    /** Получить все записи */
    getAll(): T[] {
        return [...this.data];
    }
}

// --- Session Store Interfaces ---

export interface ISessionStore {
    get(key: string): Promise<any | null>;
    set(key: string, value: any): Promise<void>;
    delete(key: string): Promise<void>;
}

export class MemoryStore implements ISessionStore {
    private store = new Map<string, any>();
    async get(key: string) { return this.store.get(key) || null; }
    async set(key: string, value: any) { this.store.set(key, value); }
    async delete(key: string) { this.store.delete(key); }
}

export class FileStore implements ISessionStore {
    private filePath: string;
    constructor(filename: string = 'sessions.json') {
        this.filePath = path.resolve(process.cwd(), filename);
    }
    async get(key: string) {
        if (!fs.existsSync(this.filePath)) return null;
        try { const d = JSON.parse(fs.readFileSync(this.filePath, 'utf-8')); return d[key] || null; } catch { return null; }
    }
    async set(key: string, value: any) {
        let d: any = {};
        if (fs.existsSync(this.filePath)) { try { d = JSON.parse(await fs.promises.readFile(this.filePath, 'utf-8')); } catch { } }
        d[key] = value;
        await fs.promises.writeFile(this.filePath, JSON.stringify(d, null, 2));
    }
    async delete(key: string) {
        if (!fs.existsSync(this.filePath)) return;
        try {
            const d = JSON.parse(await fs.promises.readFile(this.filePath, 'utf-8'));
            delete d[key];
            await fs.promises.writeFile(this.filePath, JSON.stringify(d, null, 2));
        } catch { }
    }
}

// --- Классы ---

export class Scene {
    public id: string;
    public steps: Handler[];
    constructor(id: string, ...steps: Handler[]) { this.id = id; this.steps = steps; }
}

export class Keyboard {
    static reply(buttons: (string | string[])[], options: { resize_keyboard?: boolean, one_time_keyboard?: boolean } = { resize_keyboard: true }): ReplyKeyboardMarkup {
        const keyboard = buttons.map(row => {
            if (typeof row === 'string') return [{ text: row }];
            return row.map(text => ({ text }));
        });
        return { keyboard, ...options };
    }
    static inline(rows: InlineKeyboardButton[][]): InlineKeyboardMarkup { return { inline_keyboard: rows }; }
    static callback(text: string, data: string): InlineKeyboardButton { return { text, callback_data: data }; }
    static url(text: string, url: string): InlineKeyboardButton { return { text, url }; }
    static remove() { return { remove_keyboard: true }; }
}

export class Context {
    public update: Update;
    public bot: TeleKit;
    public session: SessionContainer;

    constructor(update: Update, bot: TeleKit, session: SessionContainer) {
        this.update = update;
        this.bot = bot;
        this.session = session;
    }

    get chatId(): number | undefined {
        if ('message' in this.update) return this.update.message.chat.id;
        if ('callback_query' in this.update) return this.update.callback_query.message?.chat.id;
        return undefined;
    }
    get from(): User | undefined {
        if ('message' in this.update) return this.update.message.from;
        if ('callback_query' in this.update) return this.update.callback_query.from;
        return undefined;
    }
    get text(): string | undefined {
        if ('message' in this.update && 'text' in this.update.message) return this.update.message.text;
        return undefined;
    }
    get userId(): number | undefined {
        if ('message' in this.update) return this.update.message.from?.id;
        if ('callback_query' in this.update) return this.update.callback_query.from.id;
        return undefined;
    }

    get callbackData(): string | undefined {
        if ('callback_query' in this.update && 'data' in this.update.callback_query) return this.update.callback_query.data;
        return undefined;
    }

    async reply(text: string, extra: any = {}): Promise<any> {
        if (!this.chatId) return;
        return this.bot.api.sendMessage({ chat_id: this.chatId, text, ...extra });
    }
    async answerCallback(text?: string, alert: boolean = false) {
        if (!('callback_query' in this.update)) return;
        return this.bot.api.call('answerCallbackQuery', { callback_query_id: this.update.callback_query.id, text, show_alert: alert });
    }
    async editMessageText(text: string, extra: any = {}) {
        if (!('callback_query' in this.update) || !this.update.callback_query.message) return;
        const msg = this.update.callback_query.message;
        return this.bot.api.call('editMessageText', { chat_id: msg.chat.id, message_id: msg.message_id, text, ...extra });
    }
    async deleteMessage() {
        if (this.chatId) {
            const msgId = 'message' in this.update
                ? this.update.message.message_id
                : ('callback_query' in this.update ? this.update.callback_query.message?.message_id : undefined);
            if (msgId) return this.bot.api.call('deleteMessage', { chat_id: this.chatId, message_id: msgId });
        }
    }

    enter(sceneId: string) {
        this.session.__scene = { currentSceneId: sceneId, currentStep: 0, data: {} };
        const scene = this.bot.scenes.get(sceneId);
        if (scene && scene.steps.length > 0) scene.steps[0](this);
    }
    next() { if (this.session.__scene) this.session.__scene.currentStep++; }
    leave() { this.session.__scene = null; }
}

export class TelegramApi {
    private client: AxiosInstance;
    constructor(token: string) { this.client = axios.create({ baseURL: `https://api.telegram.org/bot${token}/`, timeout: 40000 }); }
    async call(method: string, data: any = {}): Promise<any> {
        try {
            const res = await this.client.post(method, data);
            if (!res.data.ok) throw new Error(res.data.description);
            return res.data.result;
        } catch (e: any) { console.error(`API Error [${method}]:`, e.message); return null; }
    }
    async sendMessage(params: any) { return this.call('sendMessage', params); }
}

export class TeleKit {
    public api: TelegramApi;
    public storage: ISessionStore;
    public scenes: Map<string, Scene> = new Map();

    private token: string;
    private offset = 0;
    private isPolling = false;
    private middlewares: Middleware[] = [];
    private commands = new Map<string, Handler>();
    private textPatterns = new Map<string | RegExp, Handler>();
    private callbackPatterns = new Map<string | RegExp, Handler>();
    private fallbackHandler: Handler | null = null;

    constructor(token: string, options: { store?: ISessionStore } = {}) {
        this.token = token;
        this.api = new TelegramApi(token);
        this.storage = options.store || new MemoryStore();
    }

    async setCommands(commands: { command: string; description: string }[]) { return this.api.call('setMyCommands', { commands }); }
    use(middleware: Middleware) { this.middlewares.push(middleware); }
    addScene(scene: Scene) { this.scenes.set(scene.id, scene); }
    command(cmd: string, handler: Handler) { this.commands.set(cmd.replace('/', ''), handler); }
    onText(trigger: string | RegExp, handler: Handler) { this.textPatterns.set(trigger, handler); }
    onCallback(trigger: string | RegExp, handler: Handler) { this.callbackPatterns.set(trigger, handler); }
    onMessage(handler: Handler) { this.fallbackHandler = handler; }

    async start() {
        this.isPolling = true;
        console.log('⚡ TeleKit Bot started...');
        this.loop();
    }

    private async loop() {
        if (!this.isPolling) return;
        try {
            const updates = await this.api.call('getUpdates', { offset: this.offset, timeout: 30 });
            if (updates && Array.isArray(updates)) {
                for (const update of updates) {
                    this.offset = update.update_id + 1;
                    await this.handleUpdate(update);
                }
            }
        } catch (e) { await new Promise(r => setTimeout(r, 3000)); }
        if (this.isPolling) this.loop();
    }

    private async handleUpdate(update: Update) {
        let userId: number | undefined;
        if ('message' in update) userId = update.message.from?.id;
        else if ('callback_query' in update) userId = update.callback_query.from.id;
        if (!userId) return;

        const sessionKey = `session:${userId}`;
        let sessionData = await this.storage.get(sessionKey) || {};
        const ctx = new Context(update, this, sessionData);

        let handled = false;
        for (const mw of this.middlewares) await mw(ctx, async () => { });

        if (ctx.session.__scene) {
            const s = ctx.session.__scene;
            const scene = this.scenes.get(s.currentSceneId);
            if (scene && scene.steps[s.currentStep]) { await scene.steps[s.currentStep](ctx); handled = true; }
        }

        if (!handled) {
            if (ctx.callbackData) {
                for (const [t, h] of this.callbackPatterns) if (typeof t === 'string' ? ctx.callbackData === t : t.test(ctx.callbackData)) { await h(ctx); handled = true; break; }
            }
            if (!handled && ctx.text) {
                if (ctx.text.startsWith('/')) {
                    const cmd = ctx.text.split(' ')[0].substring(1);
                    if (this.commands.has(cmd)) { await this.commands.get(cmd)!(ctx); handled = true; }
                }
                if (!handled) {
                    for (const [t, h] of this.textPatterns) if (typeof t === 'string' ? ctx.text === t : t.test(ctx.text)) { await h(ctx); handled = true; break; }
                }
            }
            if (!handled && this.fallbackHandler && ctx.text) await this.fallbackHandler(ctx);
        }
        await this.storage.set(sessionKey, ctx.session);
    }
}
