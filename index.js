const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('fs');

const GRUPO_DENUNCIAS_ID = '120363379338752657@g.us';
const ARQUIVO_CONTAGEM = 'contagem_mensagens.json';

const client = new Client({
    authStrategy: new LocalAuth()
});

client.on('qr', qr => {
    console.log('Escaneie este QR Code com seu WhatsApp:');
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    console.log('Bot está pronto!');
    console.log('Número do bot:', client.info.wid.user);
    agendarMensagemPeriodica();
});

let contagemMensagens = new Map();

if (fs.existsSync(ARQUIVO_CONTAGEM)) {
    const dados = JSON.parse(fs.readFileSync(ARQUIVO_CONTAGEM));
    contagemMensagens = new Map(Object.entries(dados));
}

const salvarContagem = () => {
    const objeto = Object.fromEntries(contagemMensagens);
    fs.writeFileSync(ARQUIVO_CONTAGEM, JSON.stringify(objeto));
};

const ultimasDenuncias = new Map();
const tempoMinimoEntreDenuncias = 30000;

client.on('message', async msg => {
    const chat = await msg.getChat();
    const sender = await msg.getContact();

    // Ignorar mensagens do próprio bot
    if (sender.id._serialized === client.info.wid._serialized) return;

    if (chat.isGroup) {
        const participants = await chat.participants;
        const admins = participants.filter(p => p.isAdmin || p.isSuperAdmin).map(a => a.id._serialized);
        const isAdmin = admins.includes(sender.id._serialized);

        const userId = sender.id._serialized;

        // Não contar mensagens do próprio bot
        if (userId !== client.info.wid._serialized) {
            if (!contagemMensagens.has(userId)) {
                contagemMensagens.set(userId, 0);
            }
            contagemMensagens.set(userId, contagemMensagens.get(userId) + 1);
            salvarContagem();
        }

        if (msg.body.startsWith('/denunciar')) {
            const agora = Date.now();
            const denuncia = msg.body.slice(10).trim();

            if (!denuncia) return msg.reply("⚠️ Escreva a denúncia após o comando.");

            if (!isAdmin) {
                const ultima = ultimasDenuncias.get(sender.id._serialized) || 0;
                const tempoDesdeUltima = agora - ultima;

                if (tempoDesdeUltima < tempoMinimoEntreDenuncias) {
                    const tempoRestante = Math.ceil((tempoMinimoEntreDenuncias - tempoDesdeUltima) / 1000);
                    return msg.reply(`Calma Calabreso, ainda falta ${tempoRestante} segundos!`);
                }

                ultimasDenuncias.set(sender.id._serialized, agora);
            }

            const texto = `🚨 *Nova denúncia recebida!* 🚨\n\nGrupo: ${chat.name}\nUsuário: ${sender.pushname || sender.number}\nNúmero: ${sender.number}\nMensagem: ${denuncia}`;
            return client.sendMessage(GRUPO_DENUNCIAS_ID, texto);
        }

        if (msg.body.startsWith('/expulsar')) {
            if (!isAdmin) return;
            const mentioned = msg.mentionedIds;
            if (mentioned.length === 0) return msg.reply('Você precisa marcar alguém para expulsar.');

            for (let userId of mentioned) {
                if (!admins.includes(userId)) {
                    await chat.removeParticipants([userId]);
                    msg.reply(`Alvo Eliminado`);
                } else {
                    msg.reply('Não posso expulsar administradores.');
                }
            }
        }

        if (msg.body === '/relatorio') {
            if (!isAdmin) return;

            let resposta = '*Contagem de mensagens no grupo:*\n';
            for (const participante of participants) {
                if (participante.id._serialized === client.info.wid._serialized) continue;
                const contato = await client.getContactById(participante.id._serialized);
                const nome = contato.pushname || contato.number;
                const total = contagemMensagens.get(participante.id._serialized) || 0;
                resposta += `- ${nome}: ${total} mensagens\n`;
            }
            return msg.reply(resposta);
        }
    }
});

client.on('group_join', async (notification) => {
    const userId = notification.id.participant;
    if (userId !== client.info.wid._serialized && !contagemMensagens.has(userId)) {
        contagemMensagens.set(userId, 0);
        salvarContagem();
    }
});

function agendarMensagemPeriodica() {
    const frases = [
        "🧠 Dica do dia: Não confie no Wi-Fi público para logins importantes!",
        "😄 Sabia que rir 15 minutos por dia pode queimar até 40 calorias?",
        "🎲 Quem não joga, não ganha!",
        "🍕 Pizza é redonda, vem em caixa quadrada e é cortada em triângulos... e você achando sua vida confusa!",
        "🤖 Eu sou apenas um bot... mas tenho sentimentos! (Mentira, não tenho)",
        "💡 A procrastinação é a arte de manter o seu futuro trabalho para o futuro.",
        "📱 Já tentou desligar e ligar de novo? Funciona até com a vida!",
        "🐢 Devagar e sempre também chega lá... às vezes atrasado, mas chega.",
        "☕ Café não resolve tudo, mas ajuda a tentar."
    ];

    const grupoId = GRUPO_DENUNCIAS_ID;

    setInterval(() => {
        const frase = frases[Math.floor(Math.random() * frases.length)];
        client.sendMessage(grupoId, frase);
    }, 1000 * 60 * 60 * 2 + Math.floor(Math.random() * 30000));
}

client.initialize();
