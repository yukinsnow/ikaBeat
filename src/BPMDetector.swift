//
//  BPMDetector.swift
//  FindBPM
//
//  Created by Yuki on 2024/9/3.
//

import Foundation
import AVFoundation
import Accelerate

class BPMDetector {
    static func detectBPM(for url: URL, completion: @escaping (Double?) -> Void) {
    DispatchQueue.global(qos: .userInitiated).async {
        guard FileManager.default.fileExists(atPath: url.path) else {
            DispatchQueue.main.async {
                print("File does not exist: \(url.path)")
                completion(nil)
            }
            return
        }
        
        let bpm = EssentiaWrapper.analyzeBPM(forFile: url.path)
        DispatchQueue.main.async {
            completion(bpm)
        }
    }
}
    
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
        
        group.notify(queue: .main) {
            completion(results)
        }
    }
}
