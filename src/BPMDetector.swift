import Foundation
import AVFoundation
import Accelerate

/// A class responsible for detecting the Beats Per Minute (BPM) of audio files
class BPMDetector {
    /// Detects the BPM for a single audio file
    /// - Parameters:
    ///   - url: The URL of the audio file
    ///   - completion: A closure called with the detected BPM or nil if detection fails
    static func detectBPM(for url: URL, completion: @escaping (Double?) -> Void) {
        DispatchQueue.global(qos: .userInitiated).async {
            // Check if the file exists
            guard FileManager.default.fileExists(atPath: url.path) else {
                DispatchQueue.main.async {
                    print("File does not exist: \(url.path)")
                    completion(nil)
                }
                return
            }
            
            // Use EssentiaWrapper to analyze the BPM
            let bpm = EssentiaWrapper.analyzeBPM(forFile: url.path)
            DispatchQueue.main.async {
                completion(bpm)
            }
        }
    }
    
    /// Detects BPM for multiple audio files concurrently
    /// - Parameters:
    ///   - urls: An array of URLs for the audio files
    ///   - progress: A closure called with the current progress (files processed and total files)
    ///   - completion: A closure called with a dictionary of URLs and their corresponding BPM values
    static func detectBPMForMultipleFiles(urls: [URL], progress: @escaping (Int, Int) -> Void, completion: @escaping ([URL: Double]) -> Void) {
        let group = DispatchGroup()
        let queue = DispatchQueue(label: "com.yourdomain.bpmdetection", attributes: .concurrent)
        
        var results = [URL: Double]()
        let resultsQueue = DispatchQueue(label: "com.yourdomain.bpmresults")
        
        for (index, url) in urls.enumerated() {
            group.enter()
            queue.async {
                detectBPM(for: url) { bpm in
                    if let bpm = bpm {
                        resultsQueue.async {
                            results[url] = bpm
                        }
                    }
                    DispatchQueue.main.async {
                        progress(index + 1, urls.count)
                    }
                    group.leave()
                }
            }
        }
        
        // Notify when all BPM detections are complete
        group.notify(queue: .main) {
            completion(results)
        }
    }
}
