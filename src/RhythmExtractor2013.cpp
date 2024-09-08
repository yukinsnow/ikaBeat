#include <essentia/essentia.h>
#include <essentia/algorithm.h>
#include <essentia/algorithmfactory.h>
#include <iostream>
#include <vector>

using namespace essentia;
using namespace essentia::standard;

extern "C" {

void initialize_essentia() {
    essentia::init();
}

void shutdown_essentia() {
    essentia::shutdown();
}

double analyze_bpm(const char* filename) {
    std::cout << "Analyzing BPM for file: " << filename << std::endl;

    try {
        AlgorithmFactory& factory = AlgorithmFactory::instance();

        Algorithm* audioLoader = factory.create("MonoLoader",
                                                "filename", filename,
                                                "sampleRate", 48000);

        Algorithm* rhythmExtractor = factory.create("RhythmExtractor2013");

        std::vector<Real> audioBuffer;
        Real bpm, confidence;
        std::vector<Real> ticks, estimates, bpmIntervals;

        audioLoader->output("audio").set(audioBuffer);
        audioLoader->compute();

        rhythmExtractor->input("signal").set(audioBuffer);
        rhythmExtractor->output("bpm").set(bpm);
        rhythmExtractor->output("confidence").set(confidence);
        rhythmExtractor->output("ticks").set(ticks);
        rhythmExtractor->output("estimates").set(estimates);
        rhythmExtractor->output("bpmIntervals").set(bpmIntervals);

        rhythmExtractor->compute();

        delete audioLoader;
        delete rhythmExtractor;

        std::cout << "Detected BPM: " << bpm << " (confidence: " << confidence << ")" << std::endl;
        return bpm;
    }
    catch (const std::exception& e) {
        std::cerr << "Error analyzing BPM: " << e.what() << std::endl;
        return -1.0;
    }
}

}
