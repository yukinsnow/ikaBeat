#import "EssentiaWrapper.h"
#import <essentia/algorithmfactory.h>
#import <essentia/essentia.h>
#import <essentia/pool.h>
#import <essentia/algorithm.h>
#import <vector>

using namespace essentia;
using namespace essentia::standard;

@implementation EssentiaWrapper

+ (double)analyzeBPMForFile:(NSString *)filePath {
    static dispatch_once_t onceToken;
    dispatch_once(&onceToken, ^{
        essentia::init();
    });
    
    @autoreleasepool {
        Real bpm = 0.0f;  // 使用 Real 类型 (通常是 float)
        
        try {
            // 创建算法工厂的实例
            AlgorithmFactory& factory = standard::AlgorithmFactory::instance();

            // 创建MonoLoader算法用于加载音频文件
            Algorithm* audioLoader = factory.create("MonoLoader",
                                                    "filename", std::string([filePath UTF8String]),
                                                    "sampleRate", 44100.0f);  // 使用 float

            std::vector<Real> inputSignal;
            audioLoader->output("audio").set(inputSignal);
            audioLoader->compute();

            // 创建RhythmExtractor2013算法实例
            Algorithm* rhythmExtractor = factory.create("RhythmExtractor2013");

            Real confidence;
            std::vector<Real> ticks, estimates, bpmIntervals;

            // 配置输入
            rhythmExtractor->input("signal").set(inputSignal);

            // 配置输出
            rhythmExtractor->output("bpm").set(bpm);
            rhythmExtractor->output("ticks").set(ticks);
            rhythmExtractor->output("estimates").set(estimates);
            rhythmExtractor->output("bpmIntervals").set(bpmIntervals);
            rhythmExtractor->output("confidence").set(confidence);

            // 计算节奏
            rhythmExtractor->compute();

            NSLog(@"Detected BPM: %f with confidence: %f", bpm, confidence);

            // 释放资源
            delete audioLoader;
            delete rhythmExtractor;
        }
        catch (const std::exception& e) {
            NSLog(@"Error in Essentia: %s", e.what());
            return 0.0; // 返回 0 表示处理失败
        }

        return (double)bpm;  // 将 Real (float) 转换为 double 返回
    }
}

+ (void)dealloc {
    essentia::shutdown();
}

@end
