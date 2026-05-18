const fs = require('fs');
const path = require('path');

const musicDir = path.join(__dirname, 'music');
const zadniDir = path.join(__dirname, 'zadni');

const audioExtensions = ['.mp3', '.wav', '.ogg', '.flac', '.aac', '.m4a', '.wma', '.webm'];
const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.svg', '.avif'];
const videoExtensions = ['.mp4', '.webm', '.mov', '.avi', '.mkv'];

function generateLists() {
    console.log('Generating file lists for Vercel...');

    // 1. Generate Music Track List
    let trackList = [];
    if (fs.existsSync(musicDir)) {
        const files = fs.readdirSync(musicDir);
        trackList = files.filter(file => {
            const ext = path.extname(file).toLowerCase();
            return audioExtensions.includes(ext);
        });
    } else {
        fs.mkdirSync(musicDir);
        console.log('Created empty "music" folder. Please put your music files there.');
    }

    // 2. Generate Backgrounds List
    let bgList = [];
    if (fs.existsSync(zadniDir)) {
        const files = fs.readdirSync(zadniDir);
        bgList = files.filter(file => {
            const ext = path.extname(file).toLowerCase();
            return imageExtensions.includes(ext) || videoExtensions.includes(ext);
        });
    } else {
        fs.mkdirSync(zadniDir);
        console.log('Created empty "zadni" folder. Please put your backgrounds there.');
    }

    // Write lists to JSON files
    fs.writeFileSync(path.join(__dirname, 'tracklist.json'), JSON.stringify(trackList, null, 2));
    fs.writeFileSync(path.join(__dirname, 'bglist.json'), JSON.stringify(bgList, null, 2));

    console.log(`Successfully generated!`);
    console.log(`- tracklist.json: ${trackList.length} tracks found.`);
    console.log(`- bglist.json: ${bgList.length} backgrounds found.`);
}

generateLists();
