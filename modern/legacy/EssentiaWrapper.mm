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
        Real bpm = 0.0f;  // Use Real type (typically float)
        
        // Create an instance of the algorithm factory
        AlgorithmFactory& factory = standard::AlgorithmFactory::instance();
        
        // Create MonoLoader algorithm for loading audio files
        Algorithm* audioLoader = factory.create("MonoLoader",
                                                    "filename", std::string([filePath UTF8String]),
                                                    "sampleRate", 44100.0f);  // Use float
        
        std::vector<Real> inputSignal;
        audioLoader->output("audio").set(inputSignal);
        try {
            audioLoader->compute();
        } catch (const std::exception& e) {
            NSLog(@"Error loading audio file: %s", e.what());
            delete audioLoader;
            return 0.0; // Return 0 to indicate processing failure
        }
        
        // Create an instance of RhythmExtractor2013 algorithm
        Algorithm* rhythmExtractor = factory.create("RhythmExtractor2013");
        
        Real confidence;
        std::vector<Real> ticks, estimates, bpmIntervals;
        
        // Configure input
        rhythmExtractor->input("signal").set(inputSignal);
        
        // Configure output
        rhythmExtractor->output("bpm").set(bpm);
        rhythmExtractor->output("ticks").set(ticks);
        rhythmExtractor->output("estimates").set(estimates);
        rhythmExtractor->output("bpmIntervals").set(bpmIntervals);
        rhythmExtractor->output("confidence").set(confidence);
        
        // Calculate rhythm
        rhythmExtractor->compute();
        
        NSLog(@"Detected BPM: %f with confidence: %f", bpm, confidence);

        return bpm; // Return the detected BPM value
    }
}

+ (void)dealloc {
    essentia::shutdown();
}

+ (void)initialize {
    essentia::isInitialized();
}

+ (void)shutdown {
    essentia::shutdown();
}

@end
