use std::ffi::{CStr, CString};
use std::os::raw::c_char;
use std::ptr;

use mogu::{FoodDetector, ImageProcessor};

/// Opaque pointer type for FoodDetector
pub struct MoguDetector {
    detector: FoodDetector,
    processor: ImageProcessor,
}

/// Create a new Mogu detector with the specified model path
/// Returns a pointer to the detector, or null on error
#[no_mangle]
pub extern "C" fn mogu_detector_new(model_path: *const c_char) -> *mut MoguDetector {
    if model_path.is_null() {
        return ptr::null_mut();
    }

    let c_str = unsafe { CStr::from_ptr(model_path) };
    let path_str = match c_str.to_str() {
        Ok(s) => s,
        Err(_) => return ptr::null_mut(),
    };

    let detector = match FoodDetector::new(path_str) {
        Ok(d) => d,
        Err(_) => return ptr::null_mut(),
    };

    let processor = ImageProcessor::with_imagenet_normalization(224, 224);

    Box::into_raw(Box::new(MoguDetector { detector, processor }))
}

/// Predict if an image contains food
/// Returns 1 if food is detected, 0 otherwise
/// probability is written to the out_probability pointer
#[no_mangle]
pub extern "C" fn mogu_predict_is_food(
    detector: *mut MoguDetector,
    image_path: *const c_char,
    out_probability: *mut f32,
) -> i32 {
    if detector.is_null() || image_path.is_null() {
        return -1;
    }

    let detector = unsafe { &mut *detector };
    
    let c_str = unsafe { CStr::from_ptr(image_path) };
    let path_str = match c_str.to_str() {
        Ok(s) => s,
        Err(_) => return -1,
    };

    let img = match image::ImageReader::open(path_str) {
        Ok(r) => match r.with_guessed_format() {
            Ok(r) => match r.decode() {
                Ok(i) => i,
                Err(_) => return -1,
            },
            Err(_) => return -1,
        },
        Err(_) => return -1,
    };

    let input = detector.processor.preprocess(&img);
    
    match detector.detector.predict_is_food(input) {
        Ok((is_food, probability)) => {
            if !out_probability.is_null() {
                unsafe { *out_probability = probability };
            }
            if is_food { 1 } else { 0 }
        }
        Err(_) => -1,
    }
}

/// Get the top prediction class index and probability
/// Returns the class index, or -1 on error
/// probability is written to the out_probability pointer
#[no_mangle]
pub extern "C" fn mogu_predict_top_class(
    detector: *mut MoguDetector,
    image_path: *const c_char,
    out_probability: *mut f32,
) -> i32 {
    if detector.is_null() || image_path.is_null() {
        return -1;
    }

    let detector = unsafe { &mut *detector };
    
    let c_str = unsafe { CStr::from_ptr(image_path) };
    let path_str = match c_str.to_str() {
        Ok(s) => s,
        Err(_) => return -1,
    };

    let img = match image::ImageReader::open(path_str) {
        Ok(r) => match r.with_guessed_format() {
            Ok(r) => match r.decode() {
                Ok(i) => i,
                Err(_) => return -1,
            },
            Err(_) => return -1,
        },
        Err(_) => return -1,
    };

    let input = detector.processor.preprocess(&img);
    
    match detector.detector.predict(input) {
        Ok(results) => {
            if let Some((class_idx, prob)) = results.first() {
                if !out_probability.is_null() {
                    unsafe { *out_probability = *prob };
                }
                *class_idx as i32
            } else {
                -1
            }
        }
        Err(_) => -1,
    }
}

/// Get the label for a given ImageNet class index
/// Returns a pointer to a C string, or null if index is invalid
/// The caller must free the returned string with mogu_free_string
#[no_mangle]
pub extern "C" fn mogu_get_label(class_index: i32) -> *mut c_char {
    if class_index < 0 {
        return ptr::null_mut();
    }

    let label = mogu::get_imagenet_label(class_index as usize);
    match CString::new(label) {
        Ok(c_str) => c_str.into_raw(),
        Err(_) => ptr::null_mut(),
    }
}

/// Free a string returned by mogu_get_label
#[no_mangle]
pub extern "C" fn mogu_free_string(s: *mut c_char) {
    if !s.is_null() {
        unsafe {
            let _ = CString::from_raw(s);
        }
    }
}

/// Free the detector
#[no_mangle]
pub extern "C" fn mogu_detector_free(detector: *mut MoguDetector) {
    if !detector.is_null() {
        unsafe {
            let _ = Box::from_raw(detector);
        }
    }
}
