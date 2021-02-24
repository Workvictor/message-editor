import { strictEqual as equal, deepStrictEqual as deepEqual } from 'assert';
import _parse from '../src/parser';
import { Token, TokenLink, TokenType } from '../src/formatted-string/types';

function parse(text: string) {
    return _parse(text, { link: true });
}

function types(tokens: Token[]): TokenType[] {
    return tokens.map(t => t.type);
}

function values(tokens: Token[]): string[] {
    return tokens.map(t => t.value);
}

/**
 * Стандартная функция для проверки ссылок в различных окружениях
 */
function testLink(link: string, isEmail = false) {
    let tokens = parse(link);
    const validate = (ix: number) => {
        const linkToken = tokens[ix] as TokenLink;
        if (isEmail) {
            equal(linkToken.link, `mailto:${link}`);
        }
    };

    deepEqual(types(tokens), [TokenType.Link], `Types: "${link}" only`);
    deepEqual(values(tokens), [link], `Values: "${link}" only`);
    validate(0);

    tokens = parse(`foo ${link} bar`);
    deepEqual(types(tokens), [TokenType.Text, TokenType.Link, TokenType.Text], `Types: "${link}" in text`);
    deepEqual(values(tokens), ['foo ', link, ' bar'], `Values: "${link}" in text`);
    validate(1);

    // Граница слов
    tokens = parse(`.${link}`);
    deepEqual(types(tokens), [TokenType.Text, TokenType.Link], `Types: "${link}" after word bound`);
    deepEqual(values(tokens), ['.', link], `Values: "${link}" after word bound`);
    validate(1);

    // Сразу за эмоджи
    tokens = parse(`${link}😍`);
    deepEqual(types(tokens), [TokenType.Link, TokenType.Emoji], `Types: "${link}" before emoji`);
    deepEqual(values(tokens), [link, '😍'], `Values: "${link}" before emoji`);
    validate(0);

    // Перед эмоджи
    tokens = parse(`👌🏻${link}`);
    deepEqual(types(tokens), [TokenType.Emoji, TokenType.Link], `Types: "${link}" after emoji`);
    deepEqual(values(tokens), ['👌🏻', link], `Values: "${link}" after emoji`);
    validate(1);

    // Перед keycap-эмоджи
    tokens = parse(`${link}2️⃣`);
    deepEqual(types(tokens), [TokenType.Link, TokenType.Emoji], `Types: "${link}" before keycap emoji`);
    deepEqual(values(tokens), [link, '2️⃣'], `Values: "${link}" before keycap emoji`);
    validate(0);

    // Адрес в скобках
    tokens = parse(`(${link})`);
    deepEqual(types(tokens), [TokenType.Text, TokenType.Link, TokenType.Text], `Types: "${link}" in braces`);
    deepEqual(values(tokens), ['(', link, ')'], `Values: "${link}" in braces`);
    validate(1);

    // Внутри русского текста
    tokens = parse(`заходите к нам на сайт ${link} и наслаждайтесь`);
    deepEqual(types(tokens), [TokenType.Text, TokenType.Link, TokenType.Text], `Types: "${link}" in Russian text`);
    deepEqual(values(tokens), ['заходите к нам на сайт ', link, ' и наслаждайтесь'], `Values: "${link}" in Russian text`);
    validate(1);

    // Внутри HTML (кавычки)
    tokens = parse(`<img src="${link}">`);
    deepEqual(types(tokens), [TokenType.Text, TokenType.Link, TokenType.Text], `Types: "${link}" in HTML`);
    deepEqual(values(tokens), ['<img src="', link, '">'], `Values: "${link}" in HTML`);
    validate(1);

    // Знак вопроса в конце предложения
    tokens = parse(`Have you seen ${link}?`);
    deepEqual(types(tokens), [TokenType.Text, TokenType.Link, TokenType.Text], `Types: "${link}" before questions sign at the end of sentence`);
    deepEqual(values(tokens), ['Have you seen ', link, '?'], `Values: "${link}" before questions sign at the end of sentence`);
    validate(1);
}

describe.only('Link', () => {
    it('valid email', () => {
        const emails = [
            'serge.che@gmail.com',
            'some.user@corp.mail.ru',
            'some.user@corp.mail.ru?m=true',

            // https://en.wikipedia.org/wiki/Email_address / Examples / Valid email addresses
            'simple@example.com',
            'very.common@example.com',
            'disposable.style.email.with+symbol@example.com',
            'other.email-with-hyphen@example.com',
            'fully-qualified-domain@example.com',
            'user.name+tag+sorting@example.com',
            'x@example.com',
            'example-indeed@strange-example.com',
            // 'admin@mailserver1'
            // 'example@s.example',
            // '" "@example.org',
            // '"john..doe"@example.org',
            'mailhost!username@example.org',
            'user%example.com@example.org',
            'user-@example.org'
        ];

        // console.log(parse('Have you seen serge.che@gmail.com?'));
        for (const email of emails) {
            testLink(email, true);
        }
    });

    it('invalid email', () => {
        // https://en.wikipedia.org/wiki/Email_address / Examples / Invalid email addresses
        let tokens = parse('Abc.example.com');
        const link = (ix: number) => tokens[ix] as TokenLink;

        // Не e-mail
        deepEqual(types(tokens), [TokenType.Link]);
        equal(link(0).link, 'http://Abc.example.com');

        tokens = parse('A@b@c@example.com');
        deepEqual(types(tokens), [TokenType.Text]);

        tokens = parse('a"b(c)d,e:f;g<h>i[j\\k]l@example.com');
        deepEqual(types(tokens), [TokenType.Text, TokenType.Link]);
        deepEqual(values(tokens), ['a"b(c)d,e:f;g<h>i[j\\k]', 'l@example.com']);

        tokens = parse('just"not"right@example.com');
        deepEqual(types(tokens), [TokenType.Text, TokenType.Link]);
        deepEqual(values(tokens), ['just"not"', 'right@example.com']);

        // Слишком длинная локальная часть
        tokens = parse('1234567890123456789012345678901234567890123456789012345678901234+x@example.com');
        deepEqual(types(tokens), [TokenType.Text]);

        // Подчёркивания нельзя
        tokens = parse('i_like_underscore@but_its_not_allowed_in_this_part.example.com');
        deepEqual(types(tokens), [TokenType.Text]);
    });
});