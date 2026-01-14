import { Update, User, InlineKeyboardButton, ReplyKeyboardMarkup, InlineKeyboardMarkup } from 'typegram';
export * from 'typegram';
export type Handler = (ctx: Context) => void | Promise<void>;
export type Middleware = (ctx: Context, next: () => Promise<void>) => Promise<void>;
interface SessionContainer {
    [key: string]: any;
}
/**
 * Простая, но мощная JSON база данных.
 * Позволяет хранить массивы данных с поиском и фильтрацией.
 */
export declare class LocalDB<T extends object> {
    private filePath;
    private data;
    constructor(filename: string);
    private load;
    private save;
    /** Добавить запись */
    push(item: T): Promise<void>;
    /** Найти одну запись */
    findOne(predicate: (item: T) => boolean): Promise<T | null>;
    /** Найти все подходящие записи */
    find(predicate: (item: T) => boolean): Promise<T[]>;
    /** Обновить запись (находим и меняем поля) */
    update(predicate: (item: T) => boolean, updates: Partial<T>): Promise<boolean>;
    /** Удалить запись */
    delete(predicate: (item: T) => boolean): Promise<void>;
    /** Получить все записи */
    getAll(): T[];
}
export interface ISessionStore {
    get(key: string): Promise<any | null>;
    set(key: string, value: any): Promise<void>;
    delete(key: string): Promise<void>;
}
export declare class MemoryStore implements ISessionStore {
    private store;
    get(key: string): Promise<any>;
    set(key: string, value: any): Promise<void>;
    delete(key: string): Promise<void>;
}
export declare class FileStore implements ISessionStore {
    private filePath;
    constructor(filename?: string);
    get(key: string): Promise<any>;
    set(key: string, value: any): Promise<void>;
    delete(key: string): Promise<void>;
}
export declare class Scene {
    id: string;
    steps: Handler[];
    constructor(id: string, ...steps: Handler[]);
}
export declare class Keyboard {
    static reply(buttons: (string | string[])[], options?: {
        resize_keyboard?: boolean;
        one_time_keyboard?: boolean;
    }): ReplyKeyboardMarkup;
    static inline(rows: InlineKeyboardButton[][]): InlineKeyboardMarkup;
    static callback(text: string, data: string): InlineKeyboardButton;
    static url(text: string, url: string): InlineKeyboardButton;
    static remove(): {
        remove_keyboard: boolean;
    };
}
export declare class Context {
    update: Update;
    bot: TeleKit;
    session: SessionContainer;
    constructor(update: Update, bot: TeleKit, session: SessionContainer);
    get chatId(): number | undefined;
    get from(): User | undefined;
    get text(): string | undefined;
    get userId(): number | undefined;
    get callbackData(): string | undefined;
    reply(text: string, extra?: any): Promise<any>;
    answerCallback(text?: string, alert?: boolean): Promise<any>;
    editMessageText(text: string, extra?: any): Promise<any>;
    deleteMessage(): Promise<any>;
    enter(sceneId: string): void;
    next(): void;
    leave(): void;
}
export declare class TelegramApi {
    private client;
    constructor(token: string);
    call(method: string, data?: any): Promise<any>;
    sendMessage(params: any): Promise<any>;
}
export declare class TeleKit {
    api: TelegramApi;
    storage: ISessionStore;
    scenes: Map<string, Scene>;
    private token;
    private offset;
    private isPolling;
    private middlewares;
    private commands;
    private textPatterns;
    private callbackPatterns;
    private fallbackHandler;
    constructor(token: string, options?: {
        store?: ISessionStore;
    });
    setCommands(commands: {
        command: string;
        description: string;
    }[]): Promise<any>;
    use(middleware: Middleware): void;
    addScene(scene: Scene): void;
    command(cmd: string, handler: Handler): void;
    onText(trigger: string | RegExp, handler: Handler): void;
    onCallback(trigger: string | RegExp, handler: Handler): void;
    onMessage(handler: Handler): void;
    start(): Promise<void>;
    private loop;
    private handleUpdate;
}
