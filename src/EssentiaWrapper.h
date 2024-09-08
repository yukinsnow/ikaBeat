#import <Foundation/Foundation.h>

@interface EssentiaWrapper : NSObject

+ (void)initialize;
+ (void)shutdown;
+ (double)analyzeBPMForFile:(NSString *)filePath;

@end
