import SwiftUI
import UniformTypeIdentifiers

struct SongItem: Identifiable {
    let id = UUID()
    let fileName: String
    var isAnalyzing: Bool = false
    var bpm: Double?
}

struct ContentView: View {
    @State private var songItems: [SongItem] = []
    @State private var isTargeted: Bool = false
    @State private var isValidDrop: Bool = true

    var body: some View {
        VStack(spacing: 0) {
            // 顶部部分：背景图片和按钮
            ZStack {
                Image("ika")
                    .resizable()
                    .aspectRatio(contentMode: .fill)
                    .frame(height: 150)  // 调整这个值以改变图片高度
                    .clipped()
                
                Button(action: selectFile) {
                    Image(systemName: "music.note.list")
                        .resizable()
                        .frame(width: 50, height: 50)
                        .padding()
                }
                .padding()
                .opacity(0.9)
            }
            .frame(maxWidth: .infinity)
            
            // 下半部分：歌曲列表
            ZStack {
                List(songItems) { item in
                    HStack {
                        Text(item.fileName)
                            .lineLimit(1)
                        Spacer()
                        if item.isAnalyzing {
                            ProgressView()
                                .scaleEffect(0.7)
                                .frame(width: 20, height: 20)
                        } else if let bpm = item.bpm {
                            Text("BPM: \(String(format: "%.2f", bpm))")
                        }
                    }
                    .frame(height: 30)
                }
                
                if isTargeted {
                    Rectangle()
                        .fill(isValidDrop ? Color.blue.opacity(0.2) : Color.red.opacity(0.2))
                        .border(isValidDrop ? Color.blue : Color.red, width: 2)
                        .allowsHitTesting(false)
                }
            }
            .onDrop(of: [.fileURL], isTargeted: $isTargeted) { providers in
                handleDrop(providers: providers)
            }
        }
        .frame(minWidth: 400, minHeight: 500)
    }
    
    private func handleDrop(providers: [NSItemProvider]) -> Bool {
        print("Handling drop of \(providers.count) items")
        
        for provider in providers {
            _ = provider.loadObject(ofClass: URL.self) { reading, error in
                guard let url = reading else {
                    print("Failed to load URL from provider")
                    return
                }
                
                if self.isAudioFile(url) {
                    print("Processing audio file: \(url.lastPathComponent)")
                    DispatchQueue.main.async {
                        self.addSongItem(url: url)
                    }
                } else {
                    print("Skipping non-audio file: \(url.lastPathComponent)")
                }
            }
        }
        
        return true
    }
    
    private func isAudioFile(_ url: URL) -> Bool {
        let supportedAudioExtensions = ["wav", "aiff", "flac", "ogg", "mp3"] // 添加其他支持的音频格式
        return supportedAudioExtensions.contains(url.pathExtension.lowercased())
    }
    
    private func addSongItem(url: URL) {
        print("Adding song item: \(url.lastPathComponent)")
        let newItem = SongItem(fileName: url.lastPathComponent, isAnalyzing: true)
        songItems.append(newItem)
        if let index = songItems.firstIndex(where: { $0.id == newItem.id }) {
            analyzeSong(url: url, for: index)
        }
    }
    
    private func analyzeSong(url: URL, for index: Int) {
        print("Analyzing song: \(url.lastPathComponent)")
        
        BPMDetector.detectBPM(for: url) { detectedBPM in
            DispatchQueue.main.async {
                if index < self.songItems.count {
                    if let bpm = detectedBPM, bpm > 0 {
                        self.songItems[index].bpm = bpm
                        print("Analysis complete for: \(url.lastPathComponent), BPM: \(bpm)")
                    } else {
                        print("Failed to detect BPM for: \(url.lastPathComponent)")
                        self.songItems[index].bpm = nil
                    }
                    self.songItems[index].isAnalyzing = false
                } else {
                    print("Error: Index out of range when updating song item")
                }
            }
        }
    }
    
    private func selectFile() {
        let panel = NSOpenPanel()
        panel.allowsMultipleSelection = true
        panel.canChooseDirectories = false
        panel.canCreateDirectories = false
        panel.canChooseFiles = true
        panel.allowedContentTypes = [UTType.audio]
        
        panel.begin { response in
            if response == .OK {
                for url in panel.urls {
                    if self.isAudioFile(url) {
                        self.addSongItem(url: url)
                    } else {
                        print("Skipping non-audio file: \(url.lastPathComponent)")
                    }
                }
            }
        }
    }
}

struct ContentView_Previews: PreviewProvider {
    static var previews: some View {
        ContentView()
    }
}
