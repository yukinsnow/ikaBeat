//
//  BPMDetector2.swift
//  FindBPM
//
//  Created by Yuki on 2024/9/5.
//

import Foundation
import AVFoundation
import Accelerate
import AudioToolbox

class BPMDetector2 {
    static func detectBPM(for url: URL, progressHandler: @escaping (Double) -> Void, completion: @escaping (Double?) -> Void) {
        DispatchQueue.global(qos: .userInitiated).async {
            guard let (samples, sampleRate) = loadAudio(from: url) else {
                DispatchQueue.main.async { completion(nil) }
                return
            }
            
            let bpm = Double(tempo(y: samples, sr: Float(sampleRate)))
            
            DispatchQueue.main.async {
                completion(bpm)
            }
        }
    }
    
    private static func tempo(y: [Float], sr: Float, hop_length: Int = 512, start_bpm: Float = 120.0, std_bpm: Float = 1.0, ac_size: Float = 8.0, max_tempo: Float? = 320.0) -> Float {
        print("1. Starting tempo function")
        
        let onset_envelope = onsetStrength(y: y, sr: sr, hop_length: hop_length)
        
        let win_length = Int(ac_size * sr / Float(hop_length))
        
        print("2. Computing tempogram")
        let tg = tempogram(onset_envelope: onset_envelope, sr: sr, hop_length: hop_length, win_length: win_length)
        
        print("3. Computing BPM values")
        let bpms = tempoFrequencies(win_length: win_length, hop_length: hop_length, sr: sr)
        
        print("4. Computing log-normal prior")
        var logprior = bpms.map { -0.5 * pow((log2($0) - log2(start_bpm)) / std_bpm, 2) }
        
        print("5. Applying max tempo threshold")
        if let max_tempo = max_tempo {
            for i in 0..<bpms.count {
                if bpms[i] >= max_tempo {
                    logprior[i] = -Float.infinity
                }
            }
        }
        
        print("6. Finding best period")
        var best_period = 0
        var max_value = -Float.infinity
        for i in 0..<tg.count {
            let value = log(1 + 1e6 * tg[i]) + logprior[i]
            if value > max_value {
                max_value = value
                best_period = i
            }
        }
        
        print("7. Estimating tempo")
        let tempo_est = bpms[best_period]
        
        print("8. Finished tempo function. BPM: \(tempo_est)")
        return tempo_est
    }
    
    private static func onsetStrength(y: [Float], sr: Float, hop_length: Int) -> [Float] {
        // This is a simplified onset strength function
        // In practice, you might want to implement a more sophisticated method
        let frame_length = 2048
        let frames = stride(from: 0, to: y.count - frame_length, by: hop_length).map {
            Array(y[$0..<$0+frame_length])
        }
        
        return frames.map { frame in
            var sum: Float = 0
            vDSP_sve(frame, 1, &sum, vDSP_Length(frame.count))
            return sum / Float(frame.count)
        }
    }
    
    private static func tempogram(onset_envelope: [Float], sr: Float, hop_length: Int, win_length: Int) -> [Float] {
        let n = onset_envelope.count
        let nfft = 2 * n
        
        // 创建 FFT 设置
        guard let fftSetup = vDSP_create_fftsetup(vDSP_Length(log2(Float(nfft))), FFTRadix(kFFTRadix2)) else {
            fatalError("Unable to create FFT setup")
        }
        defer { vDSP_destroy_fftsetup(fftSetup) }
        
        // 准备输入数据
        var realp = [Float](repeating: 0, count: nfft/2)
        var imagp = [Float](repeating: 0, count: nfft/2)
        
        // 创建可变的 DSPSplitComplex
        var splitComplex = DSPSplitComplex(realp: &realp, imagp: &imagp)
        
        // 将实数数据转换为复数格式
        var paddedInput = onset_envelope + [Float](repeating: 0, count: n)
        paddedInput.withUnsafeBufferPointer { bufferPointer in
            bufferPointer.baseAddress!.withMemoryRebound(to: DSPComplex.self, capacity: n) { complexPtr in
                vDSP_ctoz(complexPtr, 2, &splitComplex, 1, vDSP_Length(n))
            }
        }
        
        // 执行 FFT
        vDSP_fft_zrip(fftSetup, &splitComplex, 1, vDSP_Length(log2(Float(nfft))), FFTDirection(FFT_FORWARD))
        
        // 计算功率谱
        var magnitudes = [Float](repeating: 0, count: nfft/2)
        vDSP_zvmags(&splitComplex, 1, &magnitudes, 1, vDSP_Length(nfft/2))
        
        // 执行逆 FFT
        vDSP_fft_zrip(fftSetup, &splitComplex, 1, vDSP_Length(log2(Float(nfft))), FFTDirection(FFT_INVERSE))
        
        // 提取自相关结果
        var autocorr = [Float](repeating: 0, count: n)
        autocorr.withUnsafeMutableBufferPointer { autocorrPtr in
            autocorrPtr.baseAddress!.withMemoryRebound(to: DSPComplex.self, capacity: n) { complexPtr in
                vDSP_ztoc(&splitComplex, 1, complexPtr, 2, vDSP_Length(n))
            }
        }
        
        // 归一化
        var scale: Float = 1.0 / Float(n)
        vDSP_vsmul(autocorr, 1, &scale, &autocorr, 1, vDSP_Length(n))
        
        // 返回前 win_length 个元素
        return Array(autocorr.prefix(win_length))
    }
    
    private static func tempoFrequencies(win_length: Int, hop_length: Int, sr: Float) -> [Float] {
        return (0..<win_length).map { i in
            60.0 * sr / (Float(i + 1) * Float(hop_length))
        }
    }
    
    private static func loadAudio(from url: URL) -> ([Float], Double)? {
        guard let file = try? AVAudioFile(forReading: url) else { return nil }
        let format = file.processingFormat
        let sampleRate = format.sampleRate
        let frameCount = AVAudioFrameCount(file.length)
        let buffer = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: frameCount)!
        
        do {
            try file.read(into: buffer)
        } catch {
            return nil
        }
        
        guard let floatData = buffer.floatChannelData else { return nil }
        let samples = Array(UnsafeBufferPointer(start: floatData[0], count: Int(frameCount)))
        return (samples, sampleRate)
    }
    
    private static func resample(_ samples: [Float], fromSampleRate: Float, toSampleRate: Float) -> [Float] {
        let engine = AVAudioEngine()
        let buffer = AVAudioPCMBuffer(pcmFormat: AVAudioFormat(commonFormat: .pcmFormatFloat32, sampleRate: Double(fromSampleRate), channels: 1, interleaved: false)!, frameCapacity: AVAudioFrameCount(samples.count))!
        
        buffer.floatChannelData!.pointee.assign(from: samples, count: samples.count)
        buffer.frameLength = AVAudioFrameCount(samples.count)
        
        let inputNode = engine.inputNode
        let format = AVAudioFormat(commonFormat: .pcmFormatFloat32, sampleRate: Double(toSampleRate), channels: 1, interleaved: false)!
        
        let converter = AVAudioConverter(from: buffer.format, to: format)!
        
        var error: NSError?
        let outputBuffer = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: AVAudioFrameCount(Double(samples.count) * Double(toSampleRate) / Double(fromSampleRate)))!
        
        let inputBlock: AVAudioConverterInputBlock = { inNumPackets, outStatus in
            outStatus.pointee = .haveData
            return buffer
        }
        
        converter.convert(to: outputBuffer, error: &error, withInputFrom: inputBlock)
        
        if let error = error {
            print("Error during conversion: \(error)")
            return []
        }
        
        let resampledData = Array(UnsafeBufferPointer(start: outputBuffer.floatChannelData?[0], count: Int(outputBuffer.frameLength)))
        
        return resampledData
    }
    
    private static func spectrogram(_ samples: [Float], windowSize: Int, hopSize: Int) -> [[Float]] {
        let fftSize = windowSize
        let numWindows = (samples.count - windowSize) / hopSize + 1
        
        // 创建汉宁窗
        var window = [Float](repeating: 0, count: windowSize)
        vDSP_hann_window(&window, vDSP_Length(windowSize), Int32(vDSP_HANN_NORM))
        
        // 建 FFT 设置
        guard let fftSetup = vDSP_create_fftsetup(vDSP_Length(log2(Float(fftSize))), FFTRadix(kFFTRadix2)) else {
            fatalError("Unable to create FFT setup")
        }
        
        var spectrogram = [[Float]](repeating: [Float](repeating: 0, count: fftSize/2 + 1), count: numWindows)
        
        for i in 0..<numWindows {
            let start = i * hopSize
            var windowed = [Float](repeating: 0, count: windowSize)
            
            // 应用窗函数
            vDSP_vmul(Array(samples[start..<start+windowSize]), 1, window, 1, &windowed, 1, vDSP_Length(windowSize))
            
            var realp = [Float](repeating: 0, count: fftSize/2)
            var imagp = [Float](repeating: 0, count: fftSize/2)
            var splitComplex = DSPSplitComplex(realp: &realp, imagp: &imagp)
            
            // 将实数数据转换为复数格式
            windowed.withUnsafeBytes { ptr in
                vDSP_ctoz(ptr.bindMemory(to: DSPComplex.self).baseAddress!, 2, &splitComplex, 1, vDSP_Length(fftSize/2))
            }
            
            // 执行 FFT
            vDSP_fft_zrip(fftSetup, &splitComplex, 1, vDSP_Length(log2(Float(fftSize))), FFTDirection(FFT_FORWARD))
            
            // 计算幅度谱
            var magnitudes = [Float](repeating: 0, count: fftSize/2 + 1)
            vDSP_zvmags(&splitComplex, 1, &magnitudes, 1, vDSP_Length(fftSize/2))
            
            // 添加直流分量
            magnitudes[0] = splitComplex.realp[0]
            
            // 使用简单的对数转换来近似分贝刻度
            spectrogram[i] = magnitudes.map { 20 * log10(max($0, 1e-6)) }
        }
        
        // 清理 FFT 设置
        vDSP_destroy_fftsetup(fftSetup)
        
        return spectrogram
    }
    
    private static func fft2melmx(swin: Int, sr: Float, nmel: Int, minFreq: Float = 0, maxFreq: Float? = nil) -> [[Float]] {
        let maxFreq = maxFreq ?? (sr / 2)
        var minMel = frequencyToMel(minFreq)
        var maxMel = frequencyToMel(maxFreq)
        
        // 创建 mel 刻度
        var melPoints = [Float](repeating: 0, count: nmel + 2)
        vDSP_vgen(&minMel, &maxMel, &melPoints, 1, vDSP_Length(nmel + 2))
        
        // 将 mel 刻度转换回频率
        var freqPoints = melPoints.map { melToFrequency($0) }
        
        // 计算 FFT 频率点
        let fftFreqs = (0..<(swin/2 + 1)).map { Float($0) * sr / Float(swin) }
        
        // 创建滤波器组
        var filterbank = [[Float]](repeating: [Float](repeating: 0, count: swin/2 + 1), count: nmel)
        
        for i in 0..<nmel {
            let leftMel = freqPoints[i]
            let centerMel = freqPoints[i+1]
            let rightMel = freqPoints[i+2]
            
            for j in 0..<fftFreqs.count {
                let freq = fftFreqs[j]
                if freq >= leftMel && freq <= rightMel {
                    if freq <= centerMel {
                        filterbank[i][j] = (freq - leftMel) / (centerMel - leftMel)
                    } else {
                        filterbank[i][j] = (rightMel - freq) / (rightMel - centerMel)
                    }
                }
            }
        }
        
        // 归一化滤波器组
        for i in 0..<nmel {
            var sum: Float = 0
            vDSP_sve(filterbank[i], 1, &sum, vDSP_Length(filterbank[i].count))
            if sum > 0 {
                var normalizedRow = [Float](repeating: 0, count: filterbank[i].count)
                var scale = 1.0 / sum
                vDSP_vsmul(filterbank[i], 1, &scale, &normalizedRow, 1, vDSP_Length(filterbank[i].count))
                filterbank[i] = normalizedRow
            }
        }
        
        return filterbank
    }
    
    private static func efficientMelSpectrogram(_ D: [[Float]], _ mlmx: [[Float]]) -> [[Float]] {
        let transposedD = transpose(D)
        var result = [[Float]](repeating: [Float](repeating: 0, count: transposedD[0].count), count: mlmx.count)
        
        for i in 0..<mlmx.count {
            for j in 0..<transposedD[0].count {
                let tempArray = transposedD.map { abs($0[j]) }
                var sum: Float = 0
                vDSP_dotpr(mlmx[i], 1, tempArray, 1, &sum, vDSP_Length(mlmx[i].count))
                result[i][j] = 20 * log10(max(1e-10, sum))
            }
        }
        
        return result
    }
    
    private static func computeOnsetEnvelope(_ melD: [[Float]]) -> [Float] {
        let diff = melD.map { row in
            zip(row, row.dropFirst()).map { max(0, $1 - $0) }
        }
        return diff.reduce(into: [Float](repeating: 0, count: diff[0].count)) { result, row in
            for (i, value) in row.enumerated() {
                result[i] += value
            }
        }
    }
    
    private static func findPeaks(_ x: [Float], minHeight: Float? = nil, minProminence: Float = 0.1, minDistance: Int = 1) -> [Int] {
        var peaks = [Int]()
        let n = x.count
        
        // 如果没有指定 minHeight，使用数组最大值的一定比例
        let threshold = minHeight ?? (x.max() ?? 0) * 0.1
        
        for i in 1..<n-1 {
            if x[i] > threshold && x[i] > x[i-1] && x[i] > x[i+1] {
                // 检查 prominence
                let leftMin = x[max(0, i-minDistance)..<i].min() ?? x[i]
                let rightMin = x[i+1..<min(n, i+minDistance+1)].min() ?? x[i]
                let localMin = min(leftMin, rightMin)
                let prominence = x[i] - localMin
                
                if prominence >= minProminence * (x.max() ?? 1) {
                    peaks.append(i)
                }
            }
        }
        
        // 应用最小距离条件
        var filteredPeaks = [Int]()
        var lastPeak = -minDistance
        for peak in peaks {
            if peak - lastPeak >= minDistance {
                filteredPeaks.append(peak)
                lastPeak = peak
            }
        }
        
        return filteredPeaks
    }
    
    private static func estimateBPM(peaks: [Int], autocorr: [Float], sr: Float) -> Float {
        let minBPM: Float = 60
        let maxBPM: Float = 180
        var validPeaks = peaks.filter { peak in
            let bpm = 60 * sr / Float(peak)
            return bpm >= minBPM && bpm <= maxBPM
        }
        
        // 按强度排序
        validPeaks.sort { autocorr[$0] > autocorr[$1] }
        
        print("Top 10 valid peaks and their corresponding BPMs:")
        for peak in validPeaks.prefix(10) {
            let bpm = 60 * sr / Float(peak)
            print("Peak at lag \(peak): \(bpm) BPM (strength: \(autocorr[peak]))")
        }
        
        if let strongestPeak = validPeaks.first {
            let bpm = 60 * sr / Float(strongestPeak)
            print("Strongest peak at lag \(strongestPeak): \(bpm) BPM (strength: \(autocorr[strongestPeak]))")
            return bpm
        }
        
        print("No valid peaks found, returning default BPM")
        return 120
    }
    
    private static func autocorrelation(_ x: [Float], maxLag: Int) -> [Float] {
        let n = x.count
        let fftSize = vDSP_Length(nextPowerOf2(2 * n - 1))
        
        // 创建 FFT 设置
        guard let fftSetup = vDSP_create_fftsetup(vDSP_Length(log2(Float(fftSize))), FFTRadix(kFFTRadix2)) else {
            fatalError("Unable to create FFT setup")
        }
        
        // 准备输入数据
        var input = [Float](repeating: 0, count: Int(fftSize))
        vDSP_mmov(x, &input, vDSP_Length(n), 1, vDSP_Length(n), vDSP_Length(1))
        
        // 执行 FFT
        var realp = [Float](repeating: 0, count: Int(fftSize/2))
        var imagp = [Float](repeating: 0, count: Int(fftSize/2))
        var splitComplex = DSPSplitComplex(realp: &realp, imagp: &imagp)
        
        input.withUnsafeBytes { inputPtr in
            let ptr = inputPtr.bindMemory(to: DSPComplex.self)
            vDSP_ctoz(ptr.baseAddress!, 2, &splitComplex, 1, vDSP_Length(fftSize/2))
        }
        
        vDSP_fft_zrip(fftSetup, &splitComplex, 1, vDSP_Length(log2(Float(fftSize))), FFTDirection(FFT_FORWARD))
        
        // 计算功率谱
        vDSP_zvmul(&splitComplex, 1, &splitComplex, 1, &splitComplex, 1, fftSize/2, 1)
        
        // 执行逆 FFT
        vDSP_fft_zrip(fftSetup, &splitComplex, 1, vDSP_Length(log2(Float(fftSize))), FFTDirection(FFT_INVERSE))
        
        // 转换回实数域
        var result = [Float](repeating: 0, count: Int(fftSize))
        result.withUnsafeMutableBytes { resultPtr in
            let ptr = resultPtr.bindMemory(to: DSPComplex.self)
            vDSP_ztoc(&splitComplex, 1, ptr.baseAddress!, 2, vDSP_Length(fftSize/2))
        }
        
        // 归一化
        var scale = Float(1.0 / Float(n))
        vDSP_vsmul(result, 1, &scale, &result, 1, vDSP_Length(n))
        
        // 清理 FFT 设置
        vDSP_destroy_fftsetup(fftSetup)
        
        // 返回所需的延迟范围
        return Array(result[..<min(n, maxLag + 1)])
    }
    
    private static func nextPowerOf2(_ n: Int) -> Int {
        return 1 << Int(ceil(log2(Double(n))))
    }
    
    private static func frequencyToMel(_ frequency: Float) -> Float {
        return 2595 * log10(1 + frequency / 700)
    }
    
    private static func melToFrequency(_ mel: Float) -> Float {
        return 700 * (pow(10, mel / 2595) - 1)
    }
    
    // 辅助函数：转置矩阵
    private static func transpose(_ matrix: [[Float]]) -> [[Float]] {
        guard !matrix.isEmpty else { return [] }
        let rows = matrix.count
        let cols = matrix[0].count
        var result = [[Float]](repeating: [Float](repeating: 0, count: rows), count: cols)
        for i in 0..<rows {
            for j in 0..<cols {
                result[j][i] = matrix[i][j]
            }
        }
        return result
    }
}
