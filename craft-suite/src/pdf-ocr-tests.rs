    mod studio_ocr_tests {
        use super::*;
        use std::future::Future;
        use std::task::{Context, Poll, Waker};

        #[test]
        fn a_batch_waits_for_receipts_and_never_counts_failed_delivery() {
            crate::i18n::set_current(crate::i18n::Lang::EN);
            let pdf = pdfcraft_engine::Session::new().create_from_text("t", "scan").unwrap();
            let recognizers = Recognizers { primary: Arc::new(Fake { confidence: 95.0 }), secondary: None };
            for outcome in [Ok(()), Err("ACCESS_DENIED".to_string())] {
                let progress = Mutex::new(BatchProgress { total: 1, ..Default::default() });
                let receipt = Arc::new(Mutex::new(None));
                let gate = receipt.clone();
                let files = vec![("scan.pdf".into(), pdf.to_vec())];
                let settings = OcrSettings { skip_text_pages: false, ..Default::default() };
                let mut run = Box::pin(run_studio_batch_files(files, settings, &recognizers, &progress, move |name, bytes| {
                    assert_eq!(name, "scan.pdf");
                    assert!(bytes.starts_with(b"%PDF-"), "the delivered bytes must be a PDF");
                    let gate = gate.clone();
                    std::future::poll_fn(move |_| match gate.lock().unwrap().take() {
                        Some(result) => Poll::Ready(result),
                        None => Poll::Pending,
                    })
                }));
                let mut context = Context::from_waker(Waker::noop());
                assert!(run.as_mut().poll(&mut context).is_pending(), "dispatching is not a receipt");
                let saved = outcome.is_ok();
                *receipt.lock().unwrap() = Some(outcome);
                let Poll::Ready(summary) = run.as_mut().poll(&mut context) else { panic!("the receipt must settle the batch") };
                if saved {
                    assert!(summary.contains("Recognized 1 words in 1 file"), "{summary}");
                } else {
                    assert!(summary.contains("Recognized 0 words in 0 files"), "{summary}");
                    assert!(summary.contains("scan.pdf: ACCESS_DENIED"), "{summary}");
                }
            }
        }
    }
