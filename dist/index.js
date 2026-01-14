"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TeleKit = exports.TelegramApi = exports.Context = exports.Keyboard = exports.Scene = exports.FileStore = exports.MemoryStore = exports.LocalDB = void 0;
const axios_1 = __importDefault(require("axios"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
__exportStar(require("typegram"), exports);
// --- 📦 LOCAL DB SYSTEM (Встроенная база) ---
/**
 * Простая, но мощная JSON база данных.
 * Позволяет хранить массивы данных с поиском и фильтрацией.
 */
class LocalDB {
    constructor(filename) {
        this.data = [];
        this.filePath = path.resolve(process.cwd(), filename);
        this.load();
    }
    load() {
        if (!fs.existsSync(this.filePath)) {
            this.save();
            return;
        }
        try {
            this.data = JSON.parse(fs.readFileSync(this.filePath, 'utf-8'));
        }
        catch (e) {
            console.error(`Ошибка чтения БД ${this.filePath}:`, e);
            this.data = [];
        }
    }
    save() {
        fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2));
    }
    // --- Public API ---
    /** Добавить запись */
    async push(item) {
        this.data.push(item);
        this.save();
    }
    /** Найти одну запись */
    async findOne(predicate) {
        return this.data.find(predicate) || null;
    }
    /** Найти все подходящие записи */
    async find(predicate) {
        return this.data.filter(predicate);
    }
    /** Обновить запись (находим и меняем поля) */
    async update(predicate, updates) {
        const item = this.data.find(predicate);
        if (item) {
            Object.assign(item, updates);
            this.save();
            return true;
        }
        return false;
    }
    /** Удалить запись */
    async delete(predicate) {
        const initLength = this.data.length;
        this.data = this.data.filter(item => !predicate(item));
        if (this.data.length !== initLength)
            this.save();
    }
    /** Получить все записи */
    getAll() {
        return [...this.data];
    }
}
exports.LocalDB = LocalDB;
class MemoryStore {
    constructor() {
        this.store = new Map();
    }
    async get(key) { return this.store.get(key) || null; }
    async set(key, value) { this.store.set(key, value); }
    async delete(key) { this.store.delete(key); }
}
exports.MemoryStore = MemoryStore;
class FileStore {
    constructor(filename = 'sessions.json') {
        this.filePath = path.resolve(process.cwd(), filename);
    }
    async get(key) {
        if (!fs.existsSync(this.filePath))
            return null;
        try {
            const d = JSON.parse(fs.readFileSync(this.filePath, 'utf-8'));
            return d[key] || null;
        }
        catch {
            return null;
        }
    }
    async set(key, value) {
        let d = {};
        if (fs.existsSync(this.filePath)) {
            try {
                d = JSON.parse(fs.readFileSync(this.filePath, 'utf-8'));
            }
            catch { }
        }
        d[key] = value;
        fs.writeFileSync(this.filePath, JSON.stringify(d, null, 2));
    }
    async delete(key) {
        if (!fs.existsSync(this.filePath))
            return;
        const d = JSON.parse(fs.readFileSync(this.filePath, 'utf-8'));
        delete d[key];
        fs.writeFileSync(this.filePath, JSON.stringify(d, null, 2));
    }
}
exports.FileStore = FileStore;
// --- Классы ---
class Scene {
    constructor(id, ...steps) { this.id = id; this.steps = steps; }
}
exports.Scene = Scene;
class Keyboard {
    static reply(buttons, options = { resize_keyboard: true }) {
        const keyboard = buttons.map(row => {
            if (typeof row === 'string')
                return [{ text: row }];
            return row.map(text => ({ text }));
        });
        return { keyboard, ...options };
    }
    static inline(rows) { return { inline_keyboard: rows }; }
    static callback(text, data) { return { text, callback_data: data }; }
    static url(text, url) { return { text, url }; }
    static remove() { return { remove_keyboard: true }; }
}
exports.Keyboard = Keyboard;
class Context {
    constructor(update, bot, session) {
        this.update = update;
        this.bot = bot;
        this.session = session;
    }
    get chatId() {
        if ('message' in this.update)
            return this.update.message.chat.id;
        if ('callback_query' in this.update)
            return this.update.callback_query.message?.chat.id;
        return undefined;
    }
    get from() {
        if ('message' in this.update)
            return this.update.message.from;
        if ('callback_query' in this.update)
            return this.update.callback_query.from;
        return undefined;
    }
    get text() {
        if ('message' in this.update && 'text' in this.update.message)
            return this.update.message.text;
        return undefined;
    }
    get userId() {
        if ('message' in this.update)
            return this.update.message.from?.id;
        if ('callback_query' in this.update)
            return this.update.callback_query.from.id;
        return undefined;
    }
    get callbackData() {
        if ('callback_query' in this.update && 'data' in this.update.callback_query)
            return this.update.callback_query.data;
        return undefined;
    }
    async reply(text, extra = {}) {
        if (!this.chatId)
            return;
        return this.bot.api.sendMessage({ chat_id: this.chatId, text, ...extra });
    }
    async answerCallback(text, alert = false) {
        if (!('callback_query' in this.update))
            return;
        return this.bot.api.call('answerCallbackQuery', { callback_query_id: this.update.callback_query.id, text, show_alert: alert });
    }
    async editMessageText(text, extra = {}) {
        if (!('callback_query' in this.update) || !this.update.callback_query.message)
            return;
        const msg = this.update.callback_query.message;
        return this.bot.api.call('editMessageText', { chat_id: msg.chat.id, message_id: msg.message_id, text, ...extra });
    }
    async deleteMessage() {
        if (this.chatId) {
            const msgId = 'message' in this.update
                ? this.update.message.message_id
                : ('callback_query' in this.update ? this.update.callback_query.message?.message_id : undefined);
            if (msgId)
                return this.bot.api.call('deleteMessage', { chat_id: this.chatId, message_id: msgId });
        }
    }
    enter(sceneId) {
        this.session.__scene = { currentSceneId: sceneId, currentStep: 0, data: {} };
        const scene = this.bot.scenes.get(sceneId);
        if (scene && scene.steps.length > 0)
            scene.steps[0](this);
    }
    next() { if (this.session.__scene)
        this.session.__scene.currentStep++; }
    leave() { this.session.__scene = null; }
}
exports.Context = Context;
class TelegramApi {
    constructor(token) { this.client = axios_1.default.create({ baseURL: `https://api.telegram.org/bot${token}/`, timeout: 40000 }); }
    async call(method, data = {}) {
        try {
            const res = await this.client.post(method, data);
            if (!res.data.ok)
                throw new Error(res.data.description);
            return res.data.result;
        }
        catch (e) {
            console.error(`API Error [${method}]:`, e.message);
            return null;
        }
    }
    async sendMessage(params) { return this.call('sendMessage', params); }
}
exports.TelegramApi = TelegramApi;
class TeleKit {
    constructor(token, options = {}) {
        this.scenes = new Map();
        this.offset = 0;
        this.isPolling = false;
        this.middlewares = [];
        this.commands = new Map();
        this.textPatterns = new Map();
        this.callbackPatterns = new Map();
        this.fallbackHandler = null;
        this.token = token;
        this.api = new TelegramApi(token);
        this.storage = options.store || new MemoryStore();
    }
    async setCommands(commands) { return this.api.call('setMyCommands', { commands }); }
    use(middleware) { this.middlewares.push(middleware); }
    addScene(scene) { this.scenes.set(scene.id, scene); }
    command(cmd, handler) { this.commands.set(cmd.replace('/', ''), handler); }
    onText(trigger, handler) { this.textPatterns.set(trigger, handler); }
    onCallback(trigger, handler) { this.callbackPatterns.set(trigger, handler); }
    onMessage(handler) { this.fallbackHandler = handler; }
    async start() {
        this.isPolling = true;
        console.log('⚡ TeleKit Bot started...');
        this.loop();
    }
    async loop() {
        if (!this.isPolling)
            return;
        try {
            const updates = await this.api.call('getUpdates', { offset: this.offset, timeout: 30 });
            if (updates && Array.isArray(updates)) {
                for (const update of updates) {
                    this.offset = update.update_id + 1;
                    await this.handleUpdate(update);
                }
            }
        }
        catch (e) {
            await new Promise(r => setTimeout(r, 3000));
        }
        if (this.isPolling)
            this.loop();
    }
    async handleUpdate(update) {
        let userId;
        if ('message' in update)
            userId = update.message.from?.id;
        else if ('callback_query' in update)
            userId = update.callback_query.from.id;
        if (!userId)
            return;
        const sessionKey = `session:${userId}`;
        let sessionData = await this.storage.get(sessionKey) || {};
        const ctx = new Context(update, this, sessionData);
        let handled = false;
        for (const mw of this.middlewares)
            await mw(ctx, async () => { });
        if (ctx.session.__scene) {
            const s = ctx.session.__scene;
            const scene = this.scenes.get(s.currentSceneId);
            if (scene && scene.steps[s.currentStep]) {
                await scene.steps[s.currentStep](ctx);
                handled = true;
            }
        }
        if (!handled) {
            if (ctx.callbackData) {
                for (const [t, h] of this.callbackPatterns)
                    if (typeof t === 'string' ? ctx.callbackData === t : t.test(ctx.callbackData)) {
                        await h(ctx);
                        handled = true;
                        break;
                    }
            }
            if (!handled && ctx.text) {
                if (ctx.text.startsWith('/')) {
                    const cmd = ctx.text.split(' ')[0].substring(1);
                    if (this.commands.has(cmd)) {
                        await this.commands.get(cmd)(ctx);
                        handled = true;
                    }
                }
                if (!handled) {
                    for (const [t, h] of this.textPatterns)
                        if (typeof t === 'string' ? ctx.text === t : t.test(ctx.text)) {
                            await h(ctx);
                            handled = true;
                            break;
                        }
                }
            }
            if (!handled && this.fallbackHandler && ctx.text)
                await this.fallbackHandler(ctx);
        }
        await this.storage.set(sessionKey, ctx.session);
    }
}
exports.TeleKit = TeleKit;
