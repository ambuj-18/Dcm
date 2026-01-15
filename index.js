import { Client, GatewayIntentBits, Collection, REST, Routes, EmbedBuilder } from 'discord.js';
import { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus, getVoiceConnection } from '@discordjs/voice';
import play from 'play-dl';

// Environment variables
const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;

// Create client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
  ],
});

// Music queue per guild
const queues = new Map();

// Slash commands definition
const commands = [
  {
    name: 'play',
    description: 'Play a song from YouTube',
    options: [
      {
        name: 'query',
        description: 'Song name or YouTube URL',
        type: 3, // STRING
        required: true,
      },
    ],
  },
  {
    name: 'skip',
    description: 'Skip the current song',
  },
  {
    name: 'stop',
    description: 'Stop playing and clear the queue',
  },
  {
    name: 'queue',
    description: 'Show the current queue',
  },
  {
    name: 'pause',
    description: 'Pause the current song',
  },
  {
    name: 'resume',
    description: 'Resume the paused song',
  },
  {
    name: 'nowplaying',
    description: 'Show the currently playing song',
  },
  {
    name: 'volume',
    description: 'Set the volume (1-100)',
    options: [
      {
        name: 'level',
        description: 'Volume level (1-100)',
        type: 4, // INTEGER
        required: true,
        min_value: 1,
        max_value: 100,
      },
    ],
  },
];

// Deploy slash commands
async function deployCommands() {
  const rest = new REST({ version: '10' }).setToken(TOKEN);
  try {
    console.log('🔄 Registering slash commands...');
    await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
    console.log('✅ Slash commands registered!');
  } catch (error) {
    console.error('❌ Error registering commands:', error);
  }
}

// Get or create queue for a guild
function getQueue(guildId) {
  if (!queues.has(guildId)) {
    queues.set(guildId, {
      songs: [],
      player: createAudioPlayer(),
      volume: 100,
      playing: false,
    });
  }
  return queues.get(guildId);
}

// Play the next song in queue
async function playNext(guildId, voiceChannel) {
  const queue = getQueue(guildId);
  
  if (queue.songs.length === 0) {
    queue.playing = false;
    const connection = getVoiceConnection(guildId);
    if (connection) {
      setTimeout(() => {
        if (queue.songs.length === 0) {
          connection.destroy();
          queues.delete(guildId);
        }
      }, 300000); // Disconnect after 5 minutes of inactivity
    }
    return null;
  }

  const song = queue.songs[0];
  
  try {
    const stream = await play.stream(song.url);
    const resource = createAudioResource(stream.stream, {
      inputType: stream.type,
      inlineVolume: true,
    });
    
    resource.volume?.setVolume(queue.volume / 100);
    
    queue.player.play(resource);
    queue.playing = true;
    
    // Get or create voice connection
    let connection = getVoiceConnection(guildId);
    if (!connection) {
      connection = joinVoiceChannel({
        channelId: voiceChannel.id,
        guildId: guildId,
        adapterCreator: voiceChannel.guild.voiceAdapterCreator,
      });
    }
    
    connection.subscribe(queue.player);
    
    return song;
  } catch (error) {
    console.error('Error playing song:', error);
    queue.songs.shift();
    return playNext(guildId, voiceChannel);
  }
}

// Handle player state changes
function setupPlayerEvents(guildId, textChannel, voiceChannel) {
  const queue = getQueue(guildId);
  
  queue.player.on(AudioPlayerStatus.Idle, () => {
    queue.songs.shift();
    const nextSong = playNext(guildId, voiceChannel);
    if (nextSong) {
      textChannel.send(`🎵 Now playing: **${nextSong.title}**`);
    }
  });

  queue.player.on('error', (error) => {
    console.error('Player error:', error);
    queue.songs.shift();
    playNext(guildId, voiceChannel);
  });
}

// Create embed for now playing
function createNowPlayingEmbed(song) {
  return new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle('🎵 Now Playing')
    .setDescription(`**[${song.title}](${song.url})**`)
    .setThumbnail(song.thumbnail)
    .addFields(
      { name: 'Duration', value: song.duration, inline: true },
      { name: 'Requested by', value: song.requestedBy, inline: true }
    )
    .setTimestamp();
}

// Create embed for queue
function createQueueEmbed(queue) {
  const songs = queue.songs.slice(0, 10);
  const description = songs.map((song, index) => 
    `**${index + 1}.** [${song.title}](${song.url}) - ${song.duration}`
  ).join('\n');

  return new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle('📋 Music Queue')
    .setDescription(description || 'No songs in queue')
    .setFooter({ text: `Total songs: ${queue.songs.length}` })
    .setTimestamp();
}

// Handle interactions
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const { commandName, guildId, member, channel } = interaction;
  const voiceChannel = member.voice?.channel;

  // Commands that require voice channel
  const voiceCommands = ['play', 'skip', 'stop', 'pause', 'resume'];
  if (voiceCommands.includes(commandName) && !voiceChannel) {
    return interaction.reply({
      content: '❌ You need to be in a voice channel!',
      ephemeral: true,
    });
  }

  const queue = getQueue(guildId);

  switch (commandName) {
    case 'play': {
      await interaction.deferReply();
      
      const query = interaction.options.getString('query');
      
      try {
        let songInfo;
        
        // Check if it's a URL or search query
        if (play.yt_validate(query) === 'video') {
          const info = await play.video_info(query);
          songInfo = {
            title: info.video_details.title,
            url: info.video_details.url,
            duration: info.video_details.durationRaw,
            thumbnail: info.video_details.thumbnails[0]?.url,
            requestedBy: interaction.user.tag,
          };
        } else {
          const searched = await play.search(query, { limit: 1 });
          if (searched.length === 0) {
            return interaction.editReply('❌ No results found!');
          }
          songInfo = {
            title: searched[0].title,
            url: searched[0].url,
            duration: searched[0].durationRaw,
            thumbnail: searched[0].thumbnails[0]?.url,
            requestedBy: interaction.user.tag,
          };
        }

        queue.songs.push(songInfo);

        if (!queue.playing) {
          setupPlayerEvents(guildId, channel, voiceChannel);
          await playNext(guildId, voiceChannel);
          await interaction.editReply({ embeds: [createNowPlayingEmbed(songInfo)] });
        } else {
          await interaction.editReply(`✅ Added to queue: **${songInfo.title}**`);
        }
      } catch (error) {
        console.error('Play error:', error);
        await interaction.editReply('❌ Error playing the song. Please try again.');
      }
      break;
    }

    case 'skip': {
      if (queue.songs.length === 0) {
        return interaction.reply({ content: '❌ Nothing is playing!', ephemeral: true });
      }
      queue.player.stop();
      interaction.reply('⏭️ Skipped!');
      break;
    }

    case 'stop': {
      queue.songs = [];
      queue.player.stop();
      const connection = getVoiceConnection(guildId);
      if (connection) connection.destroy();
      queues.delete(guildId);
      interaction.reply('⏹️ Stopped and cleared the queue!');
      break;
    }

    case 'queue': {
      interaction.reply({ embeds: [createQueueEmbed(queue)] });
      break;
    }

    case 'pause': {
      if (queue.player.state.status === AudioPlayerStatus.Playing) {
        queue.player.pause();
        interaction.reply('⏸️ Paused!');
      } else {
        interaction.reply({ content: '❌ Nothing is playing!', ephemeral: true });
      }
      break;
    }

    case 'resume': {
      if (queue.player.state.status === AudioPlayerStatus.Paused) {
        queue.player.unpause();
        interaction.reply('▶️ Resumed!');
      } else {
        interaction.reply({ content: '❌ Nothing is paused!', ephemeral: true });
      }
      break;
    }

    case 'nowplaying': {
      if (queue.songs.length === 0) {
        return interaction.reply({ content: '❌ Nothing is playing!', ephemeral: true });
      }
      interaction.reply({ embeds: [createNowPlayingEmbed(queue.songs[0])] });
      break;
    }

    case 'volume': {
      const level = interaction.options.getInteger('level');
      queue.volume = level;
      interaction.reply(`🔊 Volume set to ${level}%`);
      break;
    }
  }
});

// Ready event
client.once('ready', () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  console.log(`📊 Serving ${client.guilds.cache.size} servers`);
  deployCommands();
});

// Login
client.login(TOKEN);

